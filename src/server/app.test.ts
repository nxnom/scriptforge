import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { RequirementService } from "./requirements/service";

describe("local API", () => {
  it("reports health", async () => {
    const response = await createApp().request("/api/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, name: "ScriptForge" });
  });

  it("serves tool interfaces with the shared browser capability policy", async () => {
    const response = await createApp().request("/api/tools/pdf-toolkit/ui");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("frame-src 'self' blob: data:");
    expect(response.headers.get("content-security-policy")).toContain("worker-src blob:");
    const html = await response.text();
    expect(html).toContain('id="result-pages"');
    expect(html).not.toContain('id="preview"');
  });

  it("lists the bundled tool catalog", async () => {
    const response = await createApp(undefined, {
      installedToolsRoot: join(tmpdir(), `scriptforge-empty-tools-${randomUUID()}`),
    }).request("/api/tools");
    const body = await response.json();
    expect(body.tools).toHaveLength(14);
    expect(body.tools[0]).toMatchObject({
      id: "image-resizer",
      version: "1.0.0",
      execution: "local",
      runtime: "Node.js",
      status: "ready",
    });
  });

  it("marks an installed tool as needing installation without removing it", async () => {
    const installedToolsRoot = join(tmpdir(), `scriptforge-tools-${randomUUID()}`);
    const toolDirectory = join(installedToolsRoot, "cli-tool");
    const { mkdir, writeFile, rm } = await import("node:fs/promises");
    await mkdir(toolDirectory, { recursive: true });
    await Promise.all([
      writeFile(
        join(toolDirectory, "tool.json"),
        JSON.stringify({
          schemaVersion: 1,
          id: "cli-tool",
          version: "1.0.0",
          name: "CLI Tool",
          description: "Uses a CLI.",
          category: "Files",
          icon: "file",
          script: "run.mjs",
          interface: { type: "html", entry: "ui.html" },
          requiredExecutables: [{ name: "missing-cli" }],
        }),
      ),
      writeFile(join(toolDirectory, "run.mjs"), ""),
      writeFile(join(toolDirectory, "ui.html"), "<!doctype html>"),
    ]);
    try {
      const requirements = new RequirementService(async () => ({ found: false, version: null }));
      const response = await createApp(undefined, { installedToolsRoot, requirements }).request("/api/tools");
      const body = await response.json();
      expect(body.tools).toContainEqual(
        expect.objectContaining({ id: "cli-tool", categories: ["Files"], status: "needs-install" }),
      );
    } finally {
      await rm(installedToolsRoot, { recursive: true, force: true });
    }
  });

  it("marks missing configuration and never returns saved secret values", async () => {
    const root = join(tmpdir(), `scriptforge-config-api-${randomUUID()}`);
    const installedToolsRoot = join(root, "tools");
    const toolDirectory = join(installedToolsRoot, "social-tool");
    const { mkdir, writeFile, rm, readFile } = await import("node:fs/promises");
    await mkdir(toolDirectory, { recursive: true });
    await Promise.all([
      writeFile(
        join(toolDirectory, "tool.json"),
        JSON.stringify({
          schemaVersion: 1,
          id: "social-tool",
          version: "1.0.0",
          name: "Social Tool",
          description: "Uses a private token.",
          category: "Social",
          icon: "share",
          script: "run.mjs",
          interface: { type: "html", entry: "ui.html" },
          requiredExecutables: [],
          configuration: [
            { key: "username", label: "Username", type: "text", required: true },
            { key: "accessToken", label: "Access token", type: "secret", required: true },
          ],
        }),
      ),
      writeFile(join(toolDirectory, "run.mjs"), ""),
      writeFile(join(toolDirectory, "ui.html"), "<!doctype html>"),
    ]);
    try {
      const configRoot = join(root, "config");
      const app = createApp(undefined, {
        installedToolsRoot,
        configRoot,
        encryptionKeyPath: join(root, "secure", "master.key"),
      });
      const before = await app.request("/api/tools");
      expect((await before.json()).tools).toContainEqual(
        expect.objectContaining({ id: "social-tool", status: "needs-config" }),
      );

      const saved = await app.request("/api/tools/social-tool/configuration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: { username: "maya", accessToken: "private-token" } }),
      });
      expect(saved.status).toBe(200);
      const status = await app.request("/api/tools/social-tool/configuration");
      const body = await status.json();
      expect(body).toMatchObject({
        ok: true,
        ready: true,
        fields: [
          { key: "username", value: "maya", configured: true },
          { key: "accessToken", configured: true },
        ],
      });
      expect(JSON.stringify(body)).not.toContain("private-token");
      expect(await readFile(join(configRoot, "social-tool.json"), "utf8")).not.toContain("private-token");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
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

  it("rejects unsupported Forge model selections before starting a terminal", async () => {
    const response = await createApp().request("/api/forge/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "unexpected-model", effort: "medium" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });
});
