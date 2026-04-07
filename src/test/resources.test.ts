import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeResourceLimits,
  resourceFlagsForRun,
  resourceFlagsForUpdate,
  resourceLimitsEqual,
  tryLiveUpdate,
  type ExecRuntimeFn,
} from "../resources";
import type { ContainerRuntimeInfo } from "../types";

const dummyRuntime: ContainerRuntimeInfo = {
  runtime: "podman",
  version: "5.0.0",
  isPodmanDockerShim: false,
};

function fakeExec(
  result: { exitCode: number; stdout?: string; stderr?: string },
  capturedArgs?: { args: string[] },
): ExecRuntimeFn {
  return async (_runtime, args) => {
    if (capturedArgs) capturedArgs.args = args;
    return {
      exitCode: result.exitCode,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  };
}

describe("mergeResourceLimits", () => {
  it("returns empty object for two undefined inputs", () => {
    assert.deepEqual(mergeResourceLimits(undefined, undefined), {});
  });

  it("returns base unchanged when override is undefined", () => {
    assert.deepEqual(
      mergeResourceLimits({ cpus: 1.5, memory: "512m" }, undefined),
      { cpus: 1.5, memory: "512m" },
    );
  });

  it("override field replaces base field", () => {
    assert.deepEqual(
      mergeResourceLimits({ cpus: 1.5, memory: "512m" }, { cpus: 2.0 }),
      { cpus: 2.0, memory: "512m" },
    );
  });

  it("undefined in override inherits base (no replace)", () => {
    assert.deepEqual(
      mergeResourceLimits({ cpus: 1.5, memory: "512m" }, { cpus: undefined }),
      { cpus: 1.5, memory: "512m" },
    );
  });

  it("null in override removes base field (RFC 7396 semantics)", () => {
    assert.deepEqual(
      mergeResourceLimits({ cpus: 1.5, memory: "512m" }, { memory: null }),
      { cpus: 1.5 },
    );
  });

  it("override can both add and remove fields in one call", () => {
    assert.deepEqual(
      mergeResourceLimits(
        { cpus: 1.5, memory: "512m" },
        { memory: null, pidsLimit: 100 },
      ),
      { cpus: 1.5, pidsLimit: 100 },
    );
  });

  it("strips null/undefined from final result", () => {
    assert.deepEqual(
      mergeResourceLimits({ cpus: undefined as any }, { memory: null }),
      {},
    );
  });

  it("override-only with empty base", () => {
    assert.deepEqual(
      mergeResourceLimits(undefined, { cpus: 2.0, memory: "1g" }),
      { cpus: 2.0, memory: "1g" },
    );
  });

  it("does not mutate the base argument", () => {
    const base = { cpus: 1.0, memory: "256m" };
    mergeResourceLimits(base, { cpus: 5.0, memory: null });
    assert.deepEqual(base, { cpus: 1.0, memory: "256m" });
  });
});

describe("resourceFlagsForRun", () => {
  it("returns empty for undefined limits", () => {
    assert.deepEqual(resourceFlagsForRun(undefined), []);
  });

  it("returns empty for empty limits object", () => {
    assert.deepEqual(resourceFlagsForRun({}), []);
  });

  it("translates cpus", () => {
    assert.deepEqual(resourceFlagsForRun({ cpus: 1.5 }), ["--cpus", "1.5"]);
  });

  it("translates memory", () => {
    assert.deepEqual(resourceFlagsForRun({ memory: "512m" }), [
      "--memory",
      "512m",
    ]);
  });

  it("translates all fields together", () => {
    const flags = resourceFlagsForRun({
      cpus: 1.5,
      cpuShares: 512,
      cpusetCpus: "1,2",
      memory: "512m",
      memorySwap: "512m",
      memoryReservation: "256m",
      pidsLimit: 200,
      oomScoreAdj: 500,
    });
    assert.deepEqual(flags, [
      "--cpus",
      "1.5",
      "--cpu-shares",
      "512",
      "--cpuset-cpus",
      "1,2",
      "--memory",
      "512m",
      "--memory-swap",
      "512m",
      "--memory-reservation",
      "256m",
      "--pids-limit",
      "200",
      "--oom-score-adj",
      "500",
    ]);
  });

  it("skips null fields (treated like unset)", () => {
    assert.deepEqual(resourceFlagsForRun({ cpus: 1.25, memory: null }), [
      "--cpus",
      "1.25",
    ]);
  });

  it("skips undefined fields", () => {
    assert.deepEqual(resourceFlagsForRun({ cpus: 1.25, memory: undefined }), [
      "--cpus",
      "1.25",
    ]);
  });
});

describe("resourceFlagsForUpdate", () => {
  it("returns flags for live-updatable fields", () => {
    const flags = resourceFlagsForUpdate({
      cpus: 2.5,
      memory: "1g",
      pidsLimit: 300,
    });
    assert.deepEqual(flags, [
      "--cpus",
      "2.5",
      "--memory",
      "1g",
      "--pids-limit",
      "300",
    ]);
  });

  it("returns null when limits include cpusetCpus (not live-updatable)", () => {
    assert.equal(
      resourceFlagsForUpdate({ cpus: 2.5, cpusetCpus: "0,1" }),
      null,
    );
  });

  it("returns null when limits include oomScoreAdj (set at create time only)", () => {
    assert.equal(
      resourceFlagsForUpdate({ memory: "1g", oomScoreAdj: 100 }),
      null,
    );
  });

  it("ignores null fields when checking live-updatability", () => {
    // cpusetCpus: null means "explicit unset" — NOT a live update obstacle
    const flags = resourceFlagsForUpdate({ cpus: 2.5, cpusetCpus: null });
    assert.deepEqual(flags, ["--cpus", "2.5"]);
  });

  it("returns empty array for empty limits (vacuously live-updatable)", () => {
    assert.deepEqual(resourceFlagsForUpdate({}), []);
  });

  it("includes only the live-updatable subset of all fields", () => {
    const flags = resourceFlagsForUpdate({
      cpus: 1.5,
      cpuShares: 1024,
      memory: "512m",
      memorySwap: "512m",
      memoryReservation: "256m",
      pidsLimit: 100,
    });
    assert.deepEqual(flags, [
      "--cpus",
      "1.5",
      "--cpu-shares",
      "1024",
      "--memory",
      "512m",
      "--memory-swap",
      "512m",
      "--memory-reservation",
      "256m",
      "--pids-limit",
      "100",
    ]);
  });
});

describe("tryLiveUpdate", () => {
  it("returns ok=true when exec succeeds", async () => {
    const captured = { args: [] as string[] };
    const exec = fakeExec({ exitCode: 0 }, captured);
    const result = await tryLiveUpdate(
      dummyRuntime,
      "sk-mayara-server",
      { cpus: 1.5 },
      exec,
    );
    assert.equal(result.ok, true);
    assert.deepEqual(captured.args, [
      "update",
      "--cpus",
      "1.5",
      "sk-mayara-server",
    ]);
  });

  it("returns ok=false with stderr when exec fails", async () => {
    const exec = fakeExec({ exitCode: 1, stderr: "no such container" });
    const result = await tryLiveUpdate(
      dummyRuntime,
      "sk-nope",
      { cpus: 1.5 },
      exec,
    );
    assert.equal(result.ok, false);
    assert.equal(result.stderr, "no such container");
  });

  it("falls back to stdout when stderr is empty", async () => {
    const exec = fakeExec({ exitCode: 1, stdout: "boom on stdout" });
    const result = await tryLiveUpdate(
      dummyRuntime,
      "sk-mayara",
      { memory: "1g" },
      exec,
    );
    assert.equal(result.ok, false);
    assert.equal(result.stderr, "boom on stdout");
  });

  it("returns ok=false WITHOUT calling exec when limits include cpusetCpus", async () => {
    let called = false;
    const exec: ExecRuntimeFn = async () => {
      called = true;
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const result = await tryLiveUpdate(
      dummyRuntime,
      "sk-mayara",
      { cpus: 1.5, cpusetCpus: "0,1" },
      exec,
    );
    assert.equal(result.ok, false);
    assert.match(result.stderr ?? "", /non-live-updatable/);
    assert.equal(called, false, "exec must not be called for non-live limits");
  });

  it("returns ok=true vacuously WITHOUT calling exec for empty limits", async () => {
    let called = false;
    const exec: ExecRuntimeFn = async () => {
      called = true;
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const result = await tryLiveUpdate(dummyRuntime, "sk-x", {}, exec);
    assert.equal(result.ok, true);
    assert.equal(called, false);
  });
});

describe("resourceLimitsEqual", () => {
  it("two undefined are equal", () => {
    assert.equal(resourceLimitsEqual(undefined, undefined), true);
  });

  it("undefined and {} are equal", () => {
    assert.equal(resourceLimitsEqual(undefined, {}), true);
  });

  it("identical objects are equal", () => {
    assert.equal(
      resourceLimitsEqual(
        { cpus: 1.5, memory: "512m" },
        { cpus: 1.5, memory: "512m" },
      ),
      true,
    );
  });

  it("different values are not equal", () => {
    assert.equal(
      resourceLimitsEqual(
        { cpus: 1.5, memory: "512m" },
        { cpus: 2.0, memory: "512m" },
      ),
      false,
    );
  });

  it("different keys are not equal", () => {
    assert.equal(
      resourceLimitsEqual({ cpus: 1.5 }, { cpus: 1.5, memory: "512m" }),
      false,
    );
  });

  it("nulls are treated as missing for equality", () => {
    assert.equal(
      resourceLimitsEqual({ cpus: 1.5, memory: null }, { cpus: 1.5 }),
      true,
    );
  });
});
