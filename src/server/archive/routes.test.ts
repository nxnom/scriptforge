// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { RequirementService } from "../requirements/service";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("tool archive API", () => {
  it("imports a missing-dependency tool but blocks only its execution", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-archive-api-"));
    roots.push(root);
    const requirements = new RequirementService(async () => ({ found: false, version: null }));
    const app = createApp(undefined, {
      installedToolsRoot: join(root, "tools"),
      jobsRoot: join(root, "jobs"),
      requirements,
    });
    const archive = archiveFile();
    const body = new FormData();
    body.set("file", new File([archive], "video-tool.forge", { type: "application/x-scriptforge-tool" }));

    const imported = await app.request("/api/tools/import", { method: "POST", body });
    expect(imported.status).toBe(201);
    await expect(imported.json()).resolves.toMatchObject({
      ok: true,
      tool: { id: "video-tool", status: "needs-install" },
    });

    const listed = await app.request("/api/tools");
    const catalog = await listed.json();
    expect(catalog.tools).toContainEqual(
      expect.objectContaining({ id: "video-tool", origin: "installed", status: "needs-install" }),
    );

    const run = new FormData();
    run.set("toolId", "video-tool");
    run.set("input", "{}");
    const blocked = await app.request("/api/jobs", { method: "POST", body: run });
    expect(blocked.status).toBe(400);
    await expect(blocked.json()).resolves.toMatchObject({ ok: false, error: expect.stringContaining("ffmpeg") });

    const exported = await app.request("/api/tools/video-tool/export");
    expect(exported.status).toBe(200);
    expect(exported.headers.get("content-type")).toBe("application/x-scriptforge-tool");
    expect(exported.headers.get("content-disposition")).toContain("video-tool.forge");

    const deleted = await app.request("/api/tools/video-tool", { method: "DELETE" });
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toEqual({ ok: true });
    const afterDelete = await app.request("/api/tools");
    expect((await afterDelete.json()).tools).not.toContainEqual(expect.objectContaining({ id: "video-tool" }));
  });

  it("refuses to delete a bundled tool", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-archive-api-"));
    roots.push(root);
    const response = await createApp(undefined, { installedToolsRoot: join(root, "tools") }).request(
      "/api/tools/image-resizer",
      { method: "DELETE" },
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Bundled tools cannot be deleted." });
  });
});

function archiveFile() {
  const manifest = {
    schemaVersion: 1,
    id: "video-tool",
    version: "1.0.0",
    name: "Video Tool",
    description: "Converts a video.",
    category: "Video",
    icon: "video",
    script: "run.mjs",
    interface: { type: "html", entry: "ui.html" },
    requiredExecutables: [{ name: "ffmpeg" }],
  };
  const encoded = (path: string, content: string) => ({
    path,
    encoding: "base64",
    content: Buffer.from(content).toString("base64"),
  });
  return JSON.stringify({
    format: "scriptforge-tool",
    formatVersion: 1,
    files: [
      encoded("tool.json", JSON.stringify(manifest)),
      encoded("run.mjs", 'throw new Error("must not execute during import")'),
      encoded("ui.html", "<!doctype html>"),
    ],
  });
}
