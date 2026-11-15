import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("uses the documented defaults", () => {
    expect(loadConfig({})).toEqual({
      HOST: "127.0.0.1",
      PORT: 6174,
      LOG_LEVEL: "info",
      NODE_ENV: "development",
    });
  });

  it("reports invalid environment values clearly", () => {
    expect(() => loadConfig({ PORT: "not-a-port" })).toThrow(
      /Invalid environment configuration: PORT:/,
    );
  });
});
