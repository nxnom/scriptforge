// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { degrees, PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { toolManifestSchema } from "../tools/manifest";
import { createApp } from "./app";
import { ToolConfigurationService } from "./configuration/service";
import { ToolJobService } from "./jobs/service";
import { RequirementService } from "./requirements/service";

function filePart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

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

  it("hydrates the bundled PDF editor without a runtime network dependency", async () => {
    const app = createApp(undefined, { jobsRoot, toolsRoot: resolve("src/tools/bundled") });
    const response = await app.request("/api/tools/pdf-toolkit/ui");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("script-src 'unsafe-inline' blob:");
    expect(response.headers.get("content-security-policy")).toContain("worker-src blob:");
    const html = await response.text();
    expect(html).toContain("function getDocument");
    expect(html).toContain("GlobalWorkerOptions.workerSrc");
    expect(html).toContain("class PDFDocumentLoadingTask");
    expect(html).not.toContain("__SCRIPT_FORGE_PDF_WORKER_BASE64__");
    expect(html).not.toContain("cdn.");
  });

  it("serves read-only script and manifest source without exposing the interface source", async () => {
    const app = createApp(undefined, { jobsRoot, toolsRoot: resolve("src/tools/bundled") });
    const response = await app.request("/api/tools/image-resizer/source");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      scriptSource: expect.stringContaining("sharp"),
      manifestSource: expect.stringContaining('"id": "image-resizer"'),
    });
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

  it("merges, reorders, and rotates PDF pages through the bundled runner", async () => {
    const first = await PDFDocument.create();
    first.addPage([300, 400]);
    const second = await PDFDocument.create();
    second.addPage([500, 600]);
    const service = new ToolJobService(jobsRoot, resolve("src/tools/bundled"));

    const { jobId } = await service.start({
      toolId: "pdf-toolkit",
      input: {
        outputMode: "single",
        compression: "none",
        pages: [
          { fileIndex: 1, pageIndex: 0, rotation: 90, width: 500, height: 600 },
          { fileIndex: 0, pageIndex: 0, rotation: 0, width: 300, height: 400 },
        ],
      },
      files: [
        new File([filePart(await first.save())], "first.pdf", { type: "application/pdf" }),
        new File([filePart(await second.save())], "second.pdf", { type: "application/pdf" }),
      ],
    });

    await expect.poll(() => service.getSnapshot(jobId)?.status).toBe("succeeded");
    const result = service.getSnapshot(jobId)?.events.find((event) => event.type === "result");
    expect(result?.type).toBe("result");
    if (result?.type !== "result") throw new Error("PDF result was not emitted.");
    const output = result.outputs[0];
    if (!output) throw new Error("Merged PDF output was not emitted.");
    const stored = await service.readOutput(jobId, output.id);
    const merged = await PDFDocument.load(stored?.data ?? new Uint8Array());
    expect(merged.getPageCount()).toBe(2);
    expect(merged.getPage(0).getSize()).toEqual({ width: 500, height: 600 });
    expect(merged.getPage(0).getRotation()).toEqual(degrees(90));
  });

  it("compresses a rendered scan into a flattened PDF with honest metadata", async () => {
    const source = await PDFDocument.create();
    source.addPage([240, 320]);
    const raster = await sharp({
      create: { width: 480, height: 640, channels: 3, background: { r: 84, g: 104, b: 255 } },
    })
      .jpeg({ quality: 95 })
      .toBuffer();
    const service = new ToolJobService(jobsRoot, resolve("src/tools/bundled"));

    const { jobId } = await service.start({
      toolId: "pdf-toolkit",
      input: {
        outputMode: "single",
        compression: "scan",
        targetMb: 1,
        pages: [{ fileIndex: 0, pageIndex: 0, rotation: 0, width: 240, height: 320, rasterFileIndex: 1 }],
      },
      files: [
        new File([filePart(await source.save())], "scan.pdf", { type: "application/pdf" }),
        new File([filePart(raster)], "page-1.jpg", { type: "image/jpeg" }),
      ],
    });

    await expect.poll(() => service.getSnapshot(jobId)?.status).toBe("succeeded");
    const result = service.getSnapshot(jobId)?.events.find((event) => event.type === "result");
    if (result?.type !== "result") throw new Error("Compressed PDF result was not emitted.");
    const output = result.outputs[0];
    if (!output) throw new Error("Compressed PDF output was not emitted.");
    expect(output.metadata).toMatchObject({ flattened: true, targetMet: true, pages: 1 });
    const stored = await service.readOutput(jobId, output.id);
    const compressed = await PDFDocument.load(stored?.data ?? new Uint8Array());
    expect(compressed.getPageCount()).toBe(1);
    expect(compressed.getPage(0).getSize()).toEqual({ width: 240, height: 320 });
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

  it("keeps an installed tool but blocks its run when an executable is missing", async () => {
    const installedRoot = join(jobsRoot, "installed");
    const toolDirectory = join(installedRoot, "video-tool");
    await mkdir(toolDirectory, { recursive: true });
    await Promise.all([
      writeFile(
        join(toolDirectory, "tool.json"),
        JSON.stringify({
          schemaVersion: 1,
          id: "video-tool",
          version: "1.0.0",
          name: "Video Tool",
          description: "Converts a video.",
          category: "Video",
          icon: "video",
          script: "run.mjs",
          interface: { type: "html", entry: "ui.html" },
          requiredExecutables: [{ name: "ffmpeg", version: ">= 7.0.0" }],
        }),
      ),
      writeFile(join(toolDirectory, "run.mjs"), ""),
      writeFile(join(toolDirectory, "ui.html"), "<!doctype html><title>Video Tool</title>"),
    ]);
    const requirements = new RequirementService(async () => ({ found: false, version: null }));
    const service = new ToolJobService(join(jobsRoot, "jobs"), undefined, installedRoot, requirements);

    await expect(service.start({ toolId: "video-tool", input: {}, files: [] })).rejects.toThrow(
      "Install the required ffmpeg executable",
    );
    await expect(service.getToolUi("video-tool")).resolves.toContain("Video Tool");
  });

  it("requires encrypted configuration, injects it into the runner, and redacts secrets", async () => {
    const installedRoot = join(jobsRoot, "configured-tools");
    const toolDirectory = join(installedRoot, "social-tool");
    const configRoot = join(jobsRoot, "config");
    const configuration = new ToolConfigurationService(configRoot, join(jobsRoot, "secure", "master.key"));
    await mkdir(toolDirectory, { recursive: true });
    const manifest = toolManifestSchema.parse({
      schemaVersion: 1,
      id: "social-tool",
      version: "1.0.0",
      name: "Social Tool",
      description: "Uses an access token.",
      category: "Social",
      icon: "share",
      script: "run.mjs",
      interface: { type: "html", entry: "ui.html" },
      requiredExecutables: [],
      configuration: [
        { key: "username", label: "Username", type: "text", required: true },
        { key: "accessToken", label: "Access token", type: "secret", required: true },
      ],
    });
    await Promise.all([
      writeFile(join(toolDirectory, "tool.json"), JSON.stringify(manifest)),
      writeFile(
        join(toolDirectory, "run.mjs"),
        `let source="";process.stdin.on("data",c=>source+=c);process.stdin.on("end",()=>{const {config}=JSON.parse(source);console.log(JSON.stringify({type:"log",level:"info",message:"Using "+config.accessToken}));console.log(JSON.stringify({type:"result",data:{username:config.username,token:config.accessToken}}));});`,
      ),
      writeFile(join(toolDirectory, "ui.html"), "<!doctype html>"),
    ]);
    const service = new ToolJobService(
      join(jobsRoot, "configured-jobs"),
      undefined,
      installedRoot,
      undefined,
      configuration,
    );

    await expect(service.start({ toolId: manifest.id, input: {}, files: [] })).rejects.toThrow(
      "Username, Access token",
    );
    await configuration.save(manifest, { username: "maya", accessToken: "private-token" });
    const { jobId } = await service.start({ toolId: manifest.id, input: {}, files: [] });

    await expect.poll(() => service.getSnapshot(jobId)?.status).toBe("succeeded");
    expect(service.getSnapshot(jobId)?.events).toContainEqual({
      type: "log",
      level: "info",
      message: "Using [REDACTED]",
    });
    expect(service.getSnapshot(jobId)?.events).toContainEqual({
      type: "result",
      outputs: [],
      data: { username: "maya", token: "[REDACTED]" },
    });
  });
});
