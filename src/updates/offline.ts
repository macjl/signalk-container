/**
 * Classify a thrown error as "offline" (network unreachable, expected
 * normal state for boats at sea) versus a "real" error (parse failure,
 * 404, repo renamed, etc.) that should be logged and counted toward
 * N-strikes auto-unregister.
 *
 * Offline errors are silent: a single debug line and the cached result
 * is returned. Never logged as errors, never affect plugin status,
 * never count toward N-strikes.
 */
export function isOfflineError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  const code = (err as NodeJS.ErrnoException).code;
  if (
    code === "ENOTFOUND" || // DNS failure
    code === "ECONNREFUSED" || // no service listening
    code === "ENETUNREACH" || // no route (typical sat-down case)
    code === "EHOSTUNREACH" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN" || // DNS retry
    code === "EPIPE"
  ) {
    return true;
  }

  // Node's native fetch wraps low-level errors and surfaces them with
  // these messages, sometimes without the .code field.
  if (err.name === "AbortError") return true;

  const msg = err.message.toLowerCase();
  if (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("getaddrinfo") ||
    msg.includes("socket hang up") ||
    msg.includes("other side closed")
  ) {
    return true;
  }

  // Check the cause chain — node fetch nests the underlying error.
  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause && cause !== err) {
    return isOfflineError(cause);
  }

  return false;
}
