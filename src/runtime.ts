import { execFile } from "child_process";
import { existsSync } from "fs";
import { ContainerRuntimeInfo, RuntimeName, RuntimePreference } from "./types";

/**
 * Detect if the Signal K server is itself running inside a container.
 * Indicators:
 * - /.dockerenv file (Docker)
 * - /run/.containerenv file (Podman)
 * - container env var (some setups)
 */
export function isContainerized(): boolean {
  return (
    existsSync("/.dockerenv") ||
    existsSync("/run/.containerenv") ||
    process.env.container !== undefined
  );
}

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("LISTEN_")) {
      delete env[key];
    }
  }
  return env;
}

function exec(
  cmd: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { env: env ?? cleanEnv(), timeout: 10000 },
      (error, stdout, stderr) => {
        resolve({
          stdout: (stdout ?? "").toString().trim(),
          stderr: (stderr ?? "").toString().trim(),
          exitCode: error
            ? typeof (error as any).code === "number"
              ? (error as any).code
              : 1
            : 0,
        });
      },
    );
  });
}

async function tryRuntime(
  name: RuntimeName,
  env: NodeJS.ProcessEnv,
): Promise<ContainerRuntimeInfo | null> {
  const result = await exec(name, ["--version"], env);
  if (result.exitCode !== 0) return null;

  const version =
    result.stdout.replace(/^.*version\s*/i, "").split(/[\s,]/)[0] || "unknown";
  let isPodmanDockerShim = false;

  if (name === "docker") {
    isPodmanDockerShim = result.stdout.toLowerCase().includes("podman");
  }

  const realRuntime: RuntimeName = isPodmanDockerShim ? "podman" : name;
  const cgroupControllers = await probeCgroupControllers(realRuntime, env);

  return {
    runtime: realRuntime,
    version,
    isPodmanDockerShim,
    cgroupControllers,
  };
}

/**
 * Query the runtime for which cgroup v2 controllers are actually
 * available to it. This matters for rootless podman, which on many
 * systems has cgroup delegation only for `cpu memory pids` and is
 * missing `cpuset` (the systemd default delegate-controllers list
 * does not include cpuset).
 *
 * Returns an array of controller names for podman, or `null` for
 * docker (which doesn't expose this via `info --format` and where
 * full controller availability is the typical case).
 */
async function probeCgroupControllers(
  runtime: RuntimeName,
  env: NodeJS.ProcessEnv,
): Promise<string[] | null> {
  if (runtime !== "podman") {
    // Docker doesn't expose CgroupControllers via `info --format`.
    // Assume all controllers are available — docker typically runs
    // as root with full systemd delegation, so this is correct in
    // the common case. Users hitting cgroup limitations on docker
    // can still see the original runtime error and adjust.
    return null;
  }

  const result = await exec(
    "podman",
    ["info", "--format", "{{json .Host.CgroupControllers}}"],
    env,
  );
  if (result.exitCode !== 0) {
    // Older podman versions, or podman info hung — fall back to
    // "not probed" rather than misleadingly empty.
    return null;
  }

  try {
    const parsed = JSON.parse(result.stdout) as unknown;
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
      return parsed;
    }
  } catch {
    // Malformed JSON — treat as not probed.
  }
  return null;
}

export async function detectRuntime(
  preference: RuntimePreference,
): Promise<ContainerRuntimeInfo | null> {
  const env = cleanEnv();

  if (preference !== "auto") {
    return tryRuntime(preference, env);
  }

  const podman = await tryRuntime("podman", env);
  if (podman) return podman;

  const docker = await tryRuntime("docker", env);
  if (docker) return docker;

  return null;
}

export function runtimeCmd(info: ContainerRuntimeInfo): string {
  return info.isPodmanDockerShim ? "docker" : info.runtime;
}

export async function execRuntime(
  info: ContainerRuntimeInfo,
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return exec(runtimeCmd(info), args, cleanEnv());
}

export async function execRuntimeLong(
  info: ContainerRuntimeInfo,
  args: string[],
  onProgress?: (msg: string) => void,
  timeout?: number,
): Promise<{ exitCode: number; log: string[] }> {
  const cmd = runtimeCmd(info);
  const env = cleanEnv();
  const log: string[] = [];
  const maxLogLines = 200;

  return new Promise((resolve, reject) => {
    const proc = execFile(cmd, args, {
      env,
      timeout: timeout ?? 600000,
      maxBuffer: 10 * 1024 * 1024,
    });

    proc.stdout?.on("data", (data: Buffer | string) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        if (log.length >= maxLogLines) log.shift();
        log.push(line);
        try {
          onProgress?.(line);
        } catch {
          /* plugin callback errors must not crash us */
        }
      }
    });

    proc.stderr?.on("data", (data: Buffer | string) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        if (log.length >= maxLogLines) log.shift();
        log.push(line);
        try {
          onProgress?.(line);
        } catch {
          /* plugin callback errors must not crash us */
        }
      }
    });

    proc.on("close", (code) => {
      resolve({ exitCode: code ?? 1, log });
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}
