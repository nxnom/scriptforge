// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { toolManifestSchema } from "../tools/manifest";
import { createApp } from "./app";
import { ToolJobService } from "./jobs/service";

describe("tool runtime host", () => {
  let jobsRoot: string;

  beforeEach(async () => {
    jobsRoot = await mkdtemp(join(tmpdir(), "scriptforge-runtime-"));
  });

  afterEach(async () => {
    await rm(jobsRoot, { recursive: true, force: true });
  });

  it("serves the self-contained tool UI with a restricted content policy", async () => {
    const app = createApp(undefined, { jobsRoot, toolsRoot: resolve("src/tools/bundled") });
    const response = await app.request("/api/tools/image-resizer/ui");

    expect(response.status).toBe(200);
    const contentPolicy = response.headers.get("content-security-policy");
    expect(contentPolicy).toContain("connect-src 'none'");
    expect(contentPolicy).toContain("img-src 'self' blob: data:");
    expect(contentPolicy).toContain("media-src 'self' blob: data:");
    await expect(response.text()).resolves.toContain('source: "scriptforge-tool"');
  });

  it("accepts an empty file list so each tool can validate its own input needs", async () => {
    const form = new FormData();
    form.append("toolId", "image-resizer");
    form.append("input", "{}");
    const app = createApp(undefined, { jobsRoot, toolsRoot: resolve("src/tools/bundled") });
    const response = await app.request("/api/jobs", { method: "POST", body: form });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ ok: true, jobId: expect.any(String) });
  });

  it("completes a data-only candidate without inventing a file output", async () => {
    const toolDirectory = join(jobsRoot, "live-price");
    await mkdir(toolDirectory, { recursive: true });
    await writeFile(
      join(toolDirectory, "run.mjs"),
      'process.stdin.resume(); process.stdin.on("end", () => console.log(JSON.stringify({type:"result",data:{price:123}})));',
    );
    const service = new ToolJobService(join(jobsRoot, "jobs"));
    const manifest = toolManifestSchema.parse({
      schemaVersion: 1,
      id: "live-price",
      version: "1.0.0",
      name: "Live Price",
      description: "Shows a live price.",
      category: "Data",
      icon: "chart",
      script: "run.mjs",
      interface: { type: "html", entry: "ui.html" },
      requiredExecutables: [],
    });

    const { jobId } = await service.startCandidate({
      toolId: manifest.id,
      input: {},
      files: [],
      directory: toolDirectory,
      manifest,
    });

    await expect.poll(() => service.getSnapshot(jobId)?.status).toBe("succeeded");
    expect(service.getSnapshot(jobId)?.events).toContainEqual({ type: "result", outputs: [], data: { price: 123 } });
  });
});
