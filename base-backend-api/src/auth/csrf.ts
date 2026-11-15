import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function sign(secret: string, nonce: string, sessionHash: string | null): string {
  return createHmac("sha256", secret)
    .update(`${nonce}:${sessionHash ?? "anon"}`)
    .digest("base64url");
}

/** `nonce.HMAC_SHA256(secret, nonce + ":" + (sessionIdHash ?? "anon"))` (API.md 9.5). */
export function issueCsrfToken(
  secret: string,
  sessionHash: string | null,
): string {
  const nonce = randomBytes(32).toString("base64url");
  return `${nonce}.${sign(secret, nonce, sessionHash)}`;
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** True when the token's signature matches the given session (or anon). */
export function verifyCsrfSignature(
  secret: string,
  token: string,
  sessionHash: string | null,
): boolean {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const nonce = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  return safeEqual(signature, sign(secret, nonce, sessionHash));
}

/** header must equal cookie AND carry a valid signature for the current session. */
export function validateCsrf(
  secret: string,
  header: string | undefined,
  cookie: string | undefined,
  sessionHash: string | null,
): boolean {
  if (!header || !cookie) return false;
  if (!safeEqual(header, cookie)) return false;
  return verifyCsrfSignature(secret, header, sessionHash);
}
