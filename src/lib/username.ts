// GitHub login rules: 1-39 chars, alphanumeric or single hyphens,
// cannot start or end with a hyphen. Shared by client and server.
export const USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export function isValidUsername(value: unknown): value is string {
  return typeof value === "string" && USERNAME_REGEX.test(value);
}
