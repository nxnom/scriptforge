// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import type { IPty, spawn as spawnPty } from "node-pty";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolConfigurationService } from "../configuration/service";
import { ToolJobService } from "../jobs/service";
import { createForgeApiRoutes } from "./routes";
import { ForgeSessionService } from "./service";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Forge candidate save", () => {
  it("rejects update sessions for bundled tools", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-save-"));
    roots.push(root);
    const spawn = vi.fn((..._args: Parameters<typeof spawnPty>) => fakePty());
    const service = new ForgeSessionService(
      { check: async () => ({ installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" }) },
      join(root, "staging"),
      spawn,
      async () => undefined,
    );
    const jobs = new ToolJobService(join(root, "jobs"), undefined, join(root, "tools"));
    const app = new Hono().route("/api/forge", createForgeApiRoutes(service, jobs, join(root, "tools")));

    const response = await app.request("/api/forge/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-5.6-sol", effort: "medium", toolId: "image-resizer" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Built-in tools cannot be updated." });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("saves the exact presented revision without requiring a Preview run", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-save-"));
    roots.push(root);
    const stagingRoot = join(root, "staging");
    const installedRoot = join(root, "tools");
    const configuration = new ToolConfigurationService(join(root, "config"), join(root, "secure", "master.key"));
    const jobs = new ToolJobService(join(root, "jobs"), undefined, installedRoot, undefined, configuration);
    const spawnCalls: Parameters<typeof spawnPty>[] = [];
    const pty = fakePty();
    const service = new ForgeSessionService(
      { check: async () => ({ installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" }) },
      stagingRoot,
      (...args) => {
        spawnCalls.push(args);
        return pty;
      },
      async () => undefined,
      { serverUrl: "http://127.0.0.1:4545", command: "node", args: ["mcp.js"] },
    );
    const { sessionId } = await service.start({ model: "gpt-5.6-sol", effort: "medium" });
    await writeCandidate(join(stagingRoot, sessionId));
    const token = sessionToken(spawnCalls[0]?.[1] ?? []);
    const candidate = await service.publishCandidate(sessionId, token, {
      summary: "Ready to review.",
      testSummary: "Standalone check passed.",
    });
    const runtime = await service.getCandidateRuntime(sessionId, candidate.revision);
    const app = new Hono().route("/api/forge", createForgeApiRoutes(service, jobs, installedRoot, configuration));

    const configured = await app.request(`/api/forge/sessions/${sessionId}/candidate/configuration`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        revision: candidate.revision,
        values: { accessToken: "candidate-secret" },
        clearSecrets: [],
      }),
    });
    expect(configured.status).toBe(200);
    expect(await configured.text()).not.toContain("candidate-secret");

    const saved = await app.request(`/api/forge/sessions/${sessionId}/candidate/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision: candidate.revision }),
    });
    expect(saved.status).toBe(201);
    expect(service.getActiveSession()).toEqual({
      sessionId,
      toolId: "tiny-tool",
      sessions: [{ sessionId, toolId: "tiny-tool", scope: "create" }],
    });
    expect(pty.kill).not.toHaveBeenCalled();
    await expect(readFile(join(installedRoot, "tiny-tool", "ui.html"), "utf8")).resolves.toContain("Tiny Tool");
    await expect(configuration.resolve(runtime.manifest)).resolves.toMatchObject({
      config: { accessToken: "candidate-secret" },
    });

    const installedRun = await jobs.start({ toolId: "tiny-tool", input: {}, files: [] });
    await expect.poll(() => jobs.getSnapshot(installedRun.jobId)?.status).toBe("succeeded");

    await mkdir(join(installedRoot, "tiny-tool", "support"));
    await writeFile(join(installedRoot, "tiny-tool", "support", "fixture.txt"), "preserved");
    await writeFile(join(stagingRoot, sessionId, "ui.html"), "<!doctype html><title>Tiny Tool Updated</title>");
    const updatedCandidate = await service.publishCandidate(sessionId, token, {
      summary: "Updated and ready to review.",
      testSummary: "Updated standalone check passed.",
    });
    const updated = await app.request(`/api/forge/sessions/${sessionId}/candidate/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision: updatedCandidate.revision }),
    });
    expect(updated.status).toBe(200);
    await expect(updated.json()).resolves.toMatchObject({ action: "updated" });
    await expect(readFile(join(installedRoot, "tiny-tool", "ui.html"), "utf8")).resolves.toContain("Updated");
    await expect(readFile(join(installedRoot, "tiny-tool", "support", "fixture.txt"), "utf8")).resolves.toBe(
      "preserved",
    );
    expect(service.getActiveSession()).toEqual({
      sessionId,
      toolId: "tiny-tool",
      sessions: [{ sessionId, toolId: "tiny-tool", scope: "create" }],
    });
    expect(pty.kill).not.toHaveBeenCalled();
  });
});

function sessionToken(value: string | string[]) {
  const args = typeof value === "string" ? [value] : value;
  const config = args.find((arg) => arg.startsWith("mcp_servers.scriptforge.args="));
  const mcpArgs = JSON.parse(config?.slice(config.indexOf("=") + 1) ?? "[]") as string[];
  return mcpArgs[mcpArgs.indexOf("--token") + 1] ?? "";
}

async function writeCandidate(directory: string) {
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(
      join(directory, "tool.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "tiny-tool",
        version: "1.0.0",
        name: "Tiny Tool",
        description: "A tiny tool.",
        category: "Files",
        icon: "file",
        script: "run.mjs",
        interface: { type: "html", entry: "ui.html" },
        requiredExecutables: [],
        configuration: [{ key: "accessToken", label: "Access token", type: "secret", required: true }],
      }),
    ),
    writeFile(
      join(directory, "run.mjs"),
      'process.stdin.resume(); process.stdin.on("end", () => console.log(JSON.stringify({type:"result",data:{ok:true}})));',
    ),
    writeFile(join(directory, "ui.html"), "<!doctype html><title>Tiny Tool</title>"),
  ]);
}

function fakePty() {
  return {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    onExit: vi.fn(() => ({ dispose: vi.fn() })),
  } as unknown as IPty;
}
