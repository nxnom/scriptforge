import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import type { IPty, spawn as spawnPty } from "node-pty";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolReferenceService } from "../../tools/reference";
import { ToolJobService } from "../jobs/service";
import { createForgeApiRoutes } from "./routes";
import { ForgeSessionService } from "./service";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Forge library reference endpoints", () => {
  it("lets Codex call the library reference tools", async () => {
    const { spawnArgs } = await startSession();
    const enabled = spawnArgs.find((arg) => arg.startsWith("mcp_servers.scriptforge.enabled_tools=")) ?? "";
    expect(enabled).toContain("scriptforge_list_tools");
    expect(enabled).toContain("scriptforge_read_tool");
  });

  it("serves the library and one tool's source only to the session's MCP token", async () => {
    const { app, sessionId, token, toolsRoot } = await startSession();

    const rejected = await app.request(`/forge/sessions/${sessionId}/library`, {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(rejected.status).toBe(403);

    const listed = await app.request(`/forge/sessions/${sessionId}/library`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listed.status).toBe(200);
    const body = await listed.json();
    expect(body.tools).toContainEqual(expect.objectContaining({ id: "social-tool", origin: "installed" }));
    expect(body.tools).toContainEqual(expect.objectContaining({ id: "image-resizer", origin: "bundled" }));

    const source = await app.request(`/forge/sessions/${sessionId}/library/social-tool`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(source.status).toBe(200);
    const read = await source.json();
    expect(read.files.map((file: { path: string }) => file.path)).toEqual(["tool.json", "run.mjs", "ui.html"]);
    expect(JSON.stringify(read)).not.toContain("private-token");
    expect(toolsRoot).toBeTruthy();

    const missing = await app.request(`/forge/sessions/${sessionId}/library/not-a-tool`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(missing.status).toBe(404);

    const unauthenticated = await app.request(`/forge/sessions/${sessionId}/library/social-tool`);
    expect(unauthenticated.status).toBe(403);
  });
});

async function startSession() {
  const root = await mkdtemp(join(tmpdir(), "scriptforge-forge-library-"));
  roots.push(root);
  const toolsRoot = join(root, "tools");
  await writeTool(toolsRoot, "social-tool");

  const pty = fakePty();
  let spawnArgs: string[] = [];
  const service = new ForgeSessionService(
    { check: async () => ({ installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" }) },
    join(root, "staging"),
    (...args: Parameters<typeof spawnPty>) => {
      spawnArgs = args[1] as string[];
      return pty;
    },
    async () => undefined,
    { serverUrl: "http://127.0.0.1:4545", command: "node", args: ["mcp.js"] },
  );
  const { sessionId } = await service.start({ model: "gpt-5.6-sol", effort: "medium" });
  const token = tokenFromArgs(spawnArgs);
  const app = new Hono().route(
    "/forge",
    createForgeApiRoutes(service, new ToolJobService(), toolsRoot, undefined, new ToolReferenceService(toolsRoot)),
  );
  return { app, sessionId, token, toolsRoot, spawnArgs };
}

function tokenFromArgs(args: string[]) {
  const serialized = args.find((arg) => arg.startsWith("mcp_servers.scriptforge.args=")) ?? "";
  const parsed = JSON.parse(serialized.replace("mcp_servers.scriptforge.args=", "")) as string[];
  return parsed[parsed.indexOf("--token") + 1] ?? "";
}

function fakePty() {
  const listeners: Array<(data: string) => void> = [];
  const pty = {
    onData: (listener: (data: string) => void) => {
      listeners.push(listener);
      return { dispose: () => undefined };
    },
    onExit: () => ({ dispose: () => undefined }),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  };
  return pty as unknown as IPty;
}

async function writeTool(toolsRoot: string, id: string) {
  const directory = join(toolsRoot, id);
  await mkdir(directory, { recursive: true });
  await writeFile(
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
      configuration: [{ key: "accessToken", label: "Access token", type: "secret", required: true }],
    }),
  );
  await writeFile(join(directory, "run.mjs"), "export default () => {};");
  await writeFile(join(directory, "ui.html"), "<main>ui</main>");
}
