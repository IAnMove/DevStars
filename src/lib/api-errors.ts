// Machine-readable error codes returned by the JSON APIs next to the
// human-readable `error` string. Safe to import from client components.
//
//   invalid_username  400  the username does not match GitHub's format
//   invalid_request   400  malformed body / JSON
//   not_found         404  GitHub has no user with that login
//   rate_limited      429  this client (IP) is sending too many requests
//   quota_exhausted   503  the server's GitHub quota is (almost) used up
//   busy              503  too many evaluations in progress / queue full
//   upstream          502  GitHub answered with an error
//   timeout           504  GitHub did not answer in time
//   config            503  the server is misconfigured (e.g. token missing)
//   internal          500  anything else
export type ApiErrorCode =
  | "invalid_username"
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "quota_exhausted"
  | "busy"
  | "upstream"
  | "timeout"
  | "config"
  | "internal";

export const API_ERROR_CODES: readonly ApiErrorCode[] = [
  "invalid_username",
  "invalid_request",
  "not_found",
  "rate_limited",
  "quota_exhausted",
  "busy",
  "upstream",
  "timeout",
  "config",
  "internal",
];

/** Errors after which trying again later makes sense. */
export function isRetryableCode(code: ApiErrorCode): boolean {
  return (
    code === "rate_limited" ||
    code === "quota_exhausted" ||
    code === "busy" ||
    code === "upstream" ||
    code === "timeout"
  );
}
