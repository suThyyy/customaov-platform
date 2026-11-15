import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing (scrypt)", () => {
  it("hashes with API.md scrypt parameters and verifies matching password", async () => {
    const hash = await hashPassword("customaov123");
    const parts = hash.split("$");

    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("scrypt");
    expect(parts[1]).toBe(String(2 ** 15));
    expect(parts[2]).toBe("8");
    expect(parts[3]).toBe("1");
    expect(parts[4]).toHaveLength(32); // 16 bytes hex
    expect(parts[5]).toHaveLength(128); // 64 bytes hex

    expect(await verifyPassword("customaov123", hash)).toBe(true);
  });

  it("produces unique salts for identical passwords", async () => {
    const h1 = await hashPassword("customaov123");
    const h2 = await hashPassword("customaov123");
    expect(h1).not.toBe(h2);
  });

  it("rejects wrong password and malformed hashes", async () => {
    const hash = await hashPassword("customaov123");

    expect(await verifyPassword("wrong-password", hash)).toBe(false);
    expect(await verifyPassword("customaov123", "")).toBe(false);
    expect(await verifyPassword("customaov123", "bcrypt$10$abc")).toBe(false);
    expect(await verifyPassword("customaov123", "scrypt$0$8$1$aa$bb")).toBe(
      false,
    );
    expect(
      await verifyPassword("customaov123", "scrypt$32768$8$1$not-hex$also-not"),
    ).toBe(false);
  });
});
