import type { ContainerResourceLimits, ContainerRuntimeInfo } from "./types";
import { execRuntime } from "./runtime";

/**
 * Resource limits known to be applyable via `podman update` /
 * `docker update`. Anything outside this set forces a recreate
 * fallback. (cpuset is intentionally excluded — kernel/cgroup
 * support varies and the failure mode is silent on some systems.)
 */
const LIVE_UPDATABLE_FIELDS: ReadonlyArray<keyof ContainerResourceLimits> = [
  "cpus",
  "cpuShares",
  "memory",
  "memorySwap",
  "memoryReservation",
  "pidsLimit",
];

/**
 * Field-level merge of two ContainerResourceLimits objects. The
 * override "wins" — but `null` in the override means "explicitly
 * remove the limit set by the base", whereas `undefined` means
 * "inherit from base". This matches RFC 7396 JSON merge patch
 * semantics for individual fields.
 *
 * Examples:
 *   merge({ cpus: 1.5, memory: "512m" }, { cpus: 2.0 })
 *     → { cpus: 2.0, memory: "512m" }
 *   merge({ cpus: 1.5, memory: "512m" }, { memory: null })
 *     → { cpus: 1.5 }
 *   merge({ cpus: 1.5 }, undefined)
 *     → { cpus: 1.5 }
 */
export function mergeResourceLimits(
  base: ContainerResourceLimits | undefined,
  override: ContainerResourceLimits | undefined,
): ContainerResourceLimits {
  const result: ContainerResourceLimits = { ...(base ?? {}) };
  if (!override) return clean(result);

  for (const key of Object.keys(override) as Array<
    keyof ContainerResourceLimits
  >) {
    const value = override[key];
    if (value === undefined) {
      // inherit base
      continue;
    }
    if (value === null) {
      // explicit unset
      delete result[key];
      continue;
    }
    // override wins (typed assignment via cast — TS can't follow the
    // discriminated indexed type narrowing here without a helper).
    (result as Record<string, unknown>)[key] = value;
  }
  return clean(result);
}

/** Strip null/undefined fields from the merged result. */
function clean(limits: ContainerResourceLimits): ContainerResourceLimits {
  const out: ContainerResourceLimits = {};
  for (const [k, v] of Object.entries(limits)) {
    if (v !== undefined && v !== null) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/**
 * Translate ContainerResourceLimits into podman/docker run flags.
 * Returns a flat array suitable for splicing into the run argv.
 * Ordering doesn't matter — both runtimes accept these in any order.
 */
export function resourceFlagsForRun(
  limits: ContainerResourceLimits | undefined,
): string[] {
  if (!limits) return [];
  const args: string[] = [];

  if (limits.cpus !== undefined && limits.cpus !== null) {
    args.push("--cpus", String(limits.cpus));
  }
  if (limits.cpuShares !== undefined && limits.cpuShares !== null) {
    args.push("--cpu-shares", String(limits.cpuShares));
  }
  if (limits.cpusetCpus !== undefined && limits.cpusetCpus !== null) {
    args.push("--cpuset-cpus", limits.cpusetCpus);
  }
  if (limits.memory !== undefined && limits.memory !== null) {
    args.push("--memory", limits.memory);
  }
  if (limits.memorySwap !== undefined && limits.memorySwap !== null) {
    args.push("--memory-swap", limits.memorySwap);
  }
  if (
    limits.memoryReservation !== undefined &&
    limits.memoryReservation !== null
  ) {
    args.push("--memory-reservation", limits.memoryReservation);
  }
  if (limits.pidsLimit !== undefined && limits.pidsLimit !== null) {
    args.push("--pids-limit", String(limits.pidsLimit));
  }
  if (limits.oomScoreAdj !== undefined && limits.oomScoreAdj !== null) {
    args.push("--oom-score-adj", String(limits.oomScoreAdj));
  }

  return args;
}

/**
 * Translate ContainerResourceLimits into the flags accepted by
 * `podman update` / `docker update`. Returns null if the limits
 * contain a field that cannot be live-updated (e.g. cpuset on some
 * kernels, or oomScoreAdj which is set at create time only).
 *
 * Caller should fall back to recreate when this returns null.
 */
export function resourceFlagsForUpdate(
  limits: ContainerResourceLimits,
): string[] | null {
  // Check whether every set field is in the live-updatable set.
  for (const key of Object.keys(limits) as Array<
    keyof ContainerResourceLimits
  >) {
    const value = limits[key];
    if (value === undefined || value === null) continue;
    if (!LIVE_UPDATABLE_FIELDS.includes(key)) {
      return null;
    }
  }

  const args: string[] = [];
  if (limits.cpus !== undefined && limits.cpus !== null) {
    args.push("--cpus", String(limits.cpus));
  }
  if (limits.cpuShares !== undefined && limits.cpuShares !== null) {
    args.push("--cpu-shares", String(limits.cpuShares));
  }
  if (limits.memory !== undefined && limits.memory !== null) {
    args.push("--memory", limits.memory);
  }
  if (limits.memorySwap !== undefined && limits.memorySwap !== null) {
    args.push("--memory-swap", limits.memorySwap);
  }
  if (
    limits.memoryReservation !== undefined &&
    limits.memoryReservation !== null
  ) {
    args.push("--memory-reservation", limits.memoryReservation);
  }
  if (limits.pidsLimit !== undefined && limits.pidsLimit !== null) {
    args.push("--pids-limit", String(limits.pidsLimit));
  }
  return args;
}

/**
 * Type of the runtime exec function. Matches `execRuntime` from
 * runtime.ts; passed in by the caller so tests can inject a stub.
 */
export type ExecRuntimeFn = (
  runtime: ContainerRuntimeInfo,
  args: string[],
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

/**
 * Attempt a live `podman update` / `docker update` on the named
 * container. Returns true on success, false on any failure (caller
 * is expected to fall back to recreate).
 *
 * The container name should already be the prefixed form (sk-...).
 * `exec` defaults to the production execRuntime; tests pass a stub.
 */
export async function tryLiveUpdate(
  runtime: ContainerRuntimeInfo,
  fullName: string,
  limits: ContainerResourceLimits,
  exec: ExecRuntimeFn = execRuntime,
): Promise<{ ok: boolean; stderr?: string }> {
  const flags = resourceFlagsForUpdate(limits);
  if (flags === null) {
    return { ok: false, stderr: "limits contain non-live-updatable fields" };
  }
  if (flags.length === 0) {
    // Nothing to apply — vacuously successful.
    return { ok: true };
  }
  const result = await exec(runtime, ["update", ...flags, fullName]);
  if (result.exitCode !== 0) {
    return { ok: false, stderr: result.stderr || result.stdout };
  }
  return { ok: true };
}

/**
 * Compare two ContainerResourceLimits for semantic equality (after
 * cleaning out null/undefined). Used to skip no-op updates when the
 * user saves the config panel without actually changing anything.
 */
export function resourceLimitsEqual(
  a: ContainerResourceLimits | undefined,
  b: ContainerResourceLimits | undefined,
): boolean {
  const ca = clean(a ?? {});
  const cb = clean(b ?? {});
  const ka = Object.keys(ca).sort();
  const kb = Object.keys(cb).sort();
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return false;
    if (
      (ca as Record<string, unknown>)[ka[i]] !==
      (cb as Record<string, unknown>)[kb[i]]
    )
      return false;
  }
  return true;
}
