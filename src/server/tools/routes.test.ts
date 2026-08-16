import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("tool clone and rename API", () => {
  it("clones an installed tool with its configuration and leaves the source untouched", async () => {
    const root = await temporaryRoot();
    const installedToolsRoot = join(root, "tools");
    await writeTool(installedToolsRoot, "social-tool");
    const app = createApp(undefined, {
      installedToolsRoot,
      configRoot: join(root, "config"),
      encryptionKeyPath: join(root, "secure", "master.key"),
      toolTitlesPath: join(root, "tool-titles.json"),
    });
    await app.request("/api/tools/social-tool/configuration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { username: "maya", accessToken: "private-token" } }),
    });

    const cloned = await app.request("/api/tools/social-tool/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Social Tool Draft" }),
    });
    expect(cloned.status).toBe(201);
    await expect(cloned.json()).resolves.toEqual({
      ok: true,
      tool: { id: "social-tool-draft", name: "Social Tool Draft" },
    });

    // The clone's secret is re-encrypted under its own id, so it resolves without touching the source.
    const clonedConfig = await (await app.request("/api/tools/social-tool-draft/configuration")).json();
    expect(clonedConfig).toMatchObject({
      ok: true,
      ready: true,
      fields: [
        { key: "username", value: "maya", configured: true },
        { key: "accessToken", configured: true },
      ],
    });
    expect(JSON.stringify(clonedConfig)).not.toContain("private-token");

    const tools = (await (await app.request("/api/tools")).json()).tools;
    expect(tools).toContainEqual(expect.objectContaining({ id: "social-tool", name: "Social Tool" }));
    expect(tools).toContainEqual(
      expect.objectContaining({ id: "social-tool-draft", name: "Social Tool Draft", origin: "installed" }),
    );
  });

  it("clones a bundled tool into an editable installed tool", async () => {
    const root = await temporaryRoot();
    const app = createApp(undefined, {
      installedToolsRoot: join(root, "tools"),
      configRoot: join(root, "config"),
      encryptionKeyPath: join(root, "secure", "master.key"),
      toolTitlesPath: join(root, "tool-titles.json"),
    });

    const cloned = await app.request("/api/tools/image-resizer/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Resizer" }),
    });
    expect(cloned.status).toBe(201);

    const tools = (await (await app.request("/api/tools")).json()).tools;
    expect(tools).toContainEqual(expect.objectContaining({ id: "image-resizer", origin: "bundled" }));
    expect(tools).toContainEqual(
      expect.objectContaining({ id: "my-resizer", name: "My Resizer", origin: "installed" }),
    );
    expect((await app.request("/api/tools/my-resizer/ui")).status).toBe(200);
  });

  it("renames bundled and installed tools and rejects unusable titles", async () => {
    const root = await temporaryRoot();
    const installedToolsRoot = join(root, "tools");
    await writeTool(installedToolsRoot, "social-tool");
    const app = createApp(undefined, {
      installedToolsRoot,
      configRoot: join(root, "config"),
      encryptionKeyPath: join(root, "secure", "master.key"),
      toolTitlesPath: join(root, "tool-titles.json"),
    });

    expect((await rename(app, "image-resizer", "Picture Resizer")).status).toBe(200);
    expect((await rename(app, "social-tool", "Poster")).status).toBe(200);
    const tools = (await (await app.request("/api/tools")).json()).tools;
    expect(tools).toContainEqual(expect.objectContaining({ id: "image-resizer", name: "Picture Resizer" }));
    expect(tools).toContainEqual(expect.objectContaining({ id: "social-tool", name: "Poster" }));

    expect((await rename(app, "social-tool", "   ")).status).toBe(400);
    expect((await rename(app, "missing-tool", "Anything")).status).toBe(404);
  });
});

function rename(app: ReturnType<typeof createApp>, toolId: string, name: string) {
  return app.request(`/api/tools/${toolId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

async function temporaryRoot() {
  const root = join(tmpdir(), `scriptforge-tool-management-${randomUUID()}`);
  roots.push(root);
  return root;
}

async function writeTool(installedToolsRoot: string, id: string) {
  const directory = join(installedToolsRoot, id);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(
      join(directory, "tool.json"),
      JSON.stringify({
        schemaVersion: 1,
        id,
        version: "1.0.0",
        name: "Social Tool",
        description: "Uses a private token.",
        categories: ["Social"],
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
    writeFile(join(directory, "run.mjs"), ""),
    writeFile(join(directory, "ui.html"), "<!doctype html>"),
  ]);
  return directory;
}
