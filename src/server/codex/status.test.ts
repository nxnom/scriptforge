import { describe, expect, it, vi } from "vitest";
import { CodexStatusService } from "./status";

describe("Codex readiness", () => {
  it("reports a missing CLI without attempting authentication", async () => {
    const run = vi.fn().mockResolvedValue({ ok: false, notFound: true, stdout: "", stderr: "" });

    await expect(new CodexStatusService(run).check()).resolves.toEqual({
      installed: false,
      authenticated: false,
      version: null,
      authMethod: null,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("reports the installed version and sanitized authentication method", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, notFound: false, stdout: "codex-cli 0.144.5", stderr: "" })
      .mockResolvedValueOnce({ ok: true, notFound: false, stdout: "Logged in using ChatGPT", stderr: "" });

    await expect(new CodexStatusService(run).check()).resolves.toEqual({
      installed: true,
      authenticated: true,
      version: "0.144.5",
      authMethod: "ChatGPT",
    });
  });
});
