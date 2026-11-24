import { AuthorizationError } from "@/server/auth/policy";
/** Domain validation errors are safe; unexpected SQL/provider details stay server-side. */
export function publicError(error: unknown): string {
  if (error instanceof AuthorizationError) return error.message;
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (
    [
      "INVALID_INPUT",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "CONCURRENCY_CONFLICT",
      "INVALID_STATE",
    ].includes(code) &&
    error instanceof Error
  )
    return error.message;
  return "The action could not be completed. Refresh and retry. If it persists, contact your administrator.";
}
export function errorStatus(error: unknown): number {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (/UNAUTHENTICATED|UNAUTHORIZED/.test(code)) return 401;
  if (/FORBIDDEN|DENIED|ADMIN_REQUIRED|RECENT_AUTH_REQUIRED/.test(code))
    return 403;
  if (/NOT_FOUND|MISSING_OBJECT/.test(code)) return 404;
  if (/CONFLICT|CONCURRENT|STALE|IMMUTABLE|INVALID_STATE|USED/.test(code))
    return 409;
  if (code === "RATE_LIMITED") return 429;
  if (code === "RANGE_NOT_SATISFIABLE") return 416;
  if (/UNAVAILABLE|PENDING_SETUP|ADMISSION_PENDING|RETRY/.test(code))
    return 503;
  if (error instanceof AuthorizationError) return 422;
  // A failed transactional assertion rejects a stale command without exposing SQL.
  if (
    error instanceof Error &&
    /CHECK constraint failed: (?:financial_guard|command_assertions|valid|ok)/.test(
      error.message,
    )
  )
    return 409;
  return 500;
}
