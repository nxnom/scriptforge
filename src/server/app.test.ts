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
});
