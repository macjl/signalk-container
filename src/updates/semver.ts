/**
 * Lightweight semver comparison. Not a full semver implementation —
 * just enough to compare image tags from container registries.
 *
 * Handles:
 * - optional "v" prefix ("v1.2.3" === "1.2.3")
 * - missing patch ("1.5" === "1.5.0")
 * - prerelease tails ("2.0.0-beta1" < "2.0.0")
 * - unequal segment counts ("1.2" < "1.2.1")
 *
 * Returns:
 *   -1  if a < b
 *    0  if a === b
 *    1  if a > b
 *
 * Throws nothing — non-parseable input compares as equal to itself
 * and unequal to anything else, with the lexically-smaller string
 * being "less". Caller should classify the tag first via tagClassifier
 * and only call compareVersions for tagKind === "semver".
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parse(a);
  const pb = parse(b);

  if (!pa || !pb) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  // Compare numeric parts left to right.
  const len = Math.max(pa.numbers.length, pb.numbers.length);
  for (let i = 0; i < len; i++) {
    const va = pa.numbers[i] ?? 0;
    const vb = pb.numbers[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }

  // Numeric parts equal. Prerelease handling: a version WITH a
  // prerelease tail is LESS than the same version WITHOUT one.
  // (e.g. 2.0.0-beta1 < 2.0.0)
  if (pa.prerelease && !pb.prerelease) return -1;
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && pb.prerelease) {
    if (pa.prerelease < pb.prerelease) return -1;
    if (pa.prerelease > pb.prerelease) return 1;
  }
  return 0;
}

interface ParsedVersion {
  numbers: number[];
  prerelease: string | null;
}

function parse(input: string): ParsedVersion | null {
  const trimmed = input.trim().replace(/^v/i, "");
  // Match: number[.number[.number]]...[-prerelease]
  const m = trimmed.match(/^(\d+(?:\.\d+)*)(?:-([\w.]+))?$/);
  if (!m) return null;
  const numbers = m[1].split(".").map((n) => Number(n));
  if (numbers.some((n) => Number.isNaN(n))) return null;
  return { numbers, prerelease: m[2] ?? null };
}
