// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { toolManifestSchema } from "../tools/manifest";
import { createApp } from "./app";
import { ToolConfigurationService } from "./configuration/service";
import { ToolJobService } from "./jobs/service";
import { RequirementService } from "./requirements/service";

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
