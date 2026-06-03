import { describe, it, expect } from "vitest";
import { aigencyHeaders, newSessionId, CLI_VERSION } from "../session.js";

describe("newSessionId", () => {
  it("is greppable + unique per call", () => {
    const a = newSessionId();
    const b = newSessionId();
    expect(a).toMatch(/^cli-[0-9a-f-]{36}$/i);
    expect(a).not.toBe(b);
  });
});

describe("aigencyHeaders", () => {
  it("identifies the CLI as a first-party agent on the given session", () => {
    const h = aigencyHeaders("cli-123");
    expect(h["X-Agent-Name"]).toBe("Aigency CLI");
    expect(h["X-Channel"]).toBe("cli");
    expect(h["X-Session-Id"]).toBe("cli-123");
    expect(h["User-Agent"]).toBe(`aigency-cli/${CLI_VERSION}`);
    expect(h.Accept).toBe("application/json");
  });
});
