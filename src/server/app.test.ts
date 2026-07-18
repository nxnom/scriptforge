import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("local API", () => {
  it("reports health", async () => {
    const response = await createApp().request("/api/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, name: "ScriptForge" });
  });

  it("lists the bundled tool catalog", async () => {
    const response = await createApp().request("/api/tools");
    const body = await response.json();
    expect(body.tools).toHaveLength(8);
    expect(body.tools[0]).toMatchObject({ id: "image-resizer", status: "ready" });
  });

  it("reports Codex readiness without exposing credential details", async () => {
    const codexStatus = {
      check: async () => ({
        installed: true,
        authenticated: true,
        version: "0.144.5",
        authMethod: "ChatGPT",
      }),
    };
    const response = await createApp(undefined, { codexStatus }).request("/api/codex/status");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, ...(await codexStatus.check()) });
  });
});
