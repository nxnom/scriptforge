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
  it("saves only the exact successfully tested revision and makes it runnable", async () => {
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

    const early = await app.request(`/api/forge/sessions/${sessionId}/candidate/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision: candidate.revision }),
    });
    expect(early.status).toBe(409);

    const form = new FormData();
    form.append("revision", candidate.revision);
    form.append("input", "{}");
    const blocked = await app.request(`/api/forge/sessions/${sessionId}/candidate/jobs`, {
      method: "POST",
      body: form,
    });
    expect(blocked.status).toBe(409);

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

    const run = await app.request(`/api/forge/sessions/${sessionId}/candidate/jobs`, { method: "POST", body: form });
    const { jobId } = (await run.json()) as { jobId: string };
    await expect.poll(() => jobs.getSnapshot(jobId)?.status).toBe("succeeded");

    const saved = await app.request(`/api/forge/sessions/${sessionId}/candidate/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision: candidate.revision }),
    });
    expect(saved.status).toBe(201);
    expect(service.getActiveSession()).toEqual({ sessionId: null });
    expect(pty.kill).toHaveBeenCalledOnce();
    await expect(readFile(join(installedRoot, "tiny-tool", "ui.html"), "utf8")).resolves.toContain("Tiny Tool");
    await expect(configuration.resolve(runtime.manifest)).resolves.toMatchObject({
      config: { accessToken: "candidate-secret" },
    });

    const installedRun = await jobs.start({ toolId: "tiny-tool", input: {}, files: [] });
    await expect.poll(() => jobs.getSnapshot(installedRun.jobId)?.status).toBe("succeeded");
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
