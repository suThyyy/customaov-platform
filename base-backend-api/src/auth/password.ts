import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 2 ** 15; // 32768
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

function deriveKey(
  password: string,
  salt: Buffer,
  keylen: number,
  N: number,
  r: number,
  p: number,
): Promise<Buffer> {
  const maxmem = Math.max(64 * 1024 * 1024, 128 * N * r * p * 2);
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, { N, r, p, maxmem }, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derivedKey);
    });
  });
}

/** Hash password with scrypt (N=2^15, r=8, p=1, keylen=64, 16-byte salt). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await deriveKey(
    password,
    salt,
    SCRYPT_KEYLEN,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
  );
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Verify password against a stored `scrypt$N$r$p$salt$hash` string. */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6) return false;

  const [scheme, nStr, rStr, pStr, saltHex, hashHex] = parts;
  if (scheme !== "scrypt" || !nStr || !rStr || !pStr || !saltHex || !hashHex) {
    return false;
  }

  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (
    !Number.isInteger(N) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    N <= 1 ||
    r <= 0 ||
    p <= 0
  ) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expectedHash = Buffer.from(hashHex, "hex");
  if (
    salt.length === 0 ||
    expectedHash.length === 0 ||
    salt.toString("hex") !== saltHex.toLowerCase() ||
    expectedHash.toString("hex") !== hashHex.toLowerCase()
  ) {
    return false;
  }

  try {
    const derivedKey = await deriveKey(
      password,
      salt,
      expectedHash.length,
      N,
      r,
      p,
    );
    if (derivedKey.length !== expectedHash.length) return false;
    return timingSafeEqual(derivedKey, expectedHash);
  } catch {
    return false;
  }
}
