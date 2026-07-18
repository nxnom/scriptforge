import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IPty, spawn as spawnPty } from "node-pty";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForgeSessionService } from "./service";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Forge terminal sessions", () => {
  it("spawns Codex in staging with explicit safe settings", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-staging-"));
    roots.push(root);
    const pty = fakePty();
    const calls: Parameters<typeof spawnPty>[] = [];
    const spawn = (...args: Parameters<typeof spawnPty>) => {
      calls.push(args);
      return pty.value;
    };
    const trust = vi.fn(async () => undefined);
    const status = {
      check: async () => ({ installed: true, authenticated: true, version: "0.144.5", authMethod: "ChatGPT" }),
    };
    const service = new ForgeSessionService(status, root, spawn, trust);

    const { sessionId } = await service.start({ model: "gpt-5.6-sol", effort: "medium" });
    const [command, args, options] = calls[0] as Parameters<typeof spawnPty>;

    expect(command).toMatch(/^codex(?:\.cmd)?$/);
    expect(args).toEqual(expect.arrayContaining(["-m", "gpt-5.6-sol", "--sandbox", "workspace-write", "on-request"]));
    expect(args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
    expect(options.cwd).toBe(join(root, sessionId));
    expect(options.env?.TERM).toBe("xterm-256color");
    expect(trust).toHaveBeenCalledWith(join(root, sessionId));

    service.write(sessionId, "hello");
    service.resize(sessionId, 120, 40);
    expect(pty.write).toHaveBeenCalledWith("hello");
    expect(pty.resize).toHaveBeenCalledWith(120, 40);
  });

  it("does not spawn before Codex is authenticated", async () => {
    const spawn = vi.fn((..._args: Parameters<typeof spawnPty>) => fakePty().value);
    const status = {
      check: async () => ({ installed: true, authenticated: false, version: "0.144.5", authMethod: null }),
    };
    const service = new ForgeSessionService(status, tmpdir(), spawn, async () => undefined);

    await expect(service.start({ model: "gpt-5.6-sol", effort: "medium" })).rejects.toThrow("codex login");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("keeps the active session alive without a browser connection", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-staging-"));
    roots.push(root);
    const pty = fakePty();
    const status = {
      check: async () => ({ installed: true, authenticated: true, version: "0.144.5", authMethod: "ChatGPT" }),
    };
    const service = new ForgeSessionService(
      status,
      root,
      () => pty.value,
      async () => undefined,
    );
    const { sessionId } = await service.start({ model: "gpt-5.6-sol", effort: "medium" });

    expect(service.getActiveSession()).toEqual({ sessionId });
    expect(pty.kill).not.toHaveBeenCalled();
  });

  it("keeps only the newest Forge session in memory", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-staging-"));
    roots.push(root);
    const first = fakePty();
    const second = fakePty();
    const sessions = [first.value, second.value];
    const status = {
      check: async () => ({ installed: true, authenticated: true, version: "0.144.5", authMethod: "ChatGPT" }),
    };
    const service = new ForgeSessionService(
      status,
      root,
      () => sessions.shift() as IPty,
      async () => undefined,
    );
    const previous = await service.start({ model: "gpt-5.6-sol", effort: "medium" });
    const current = await service.start({ model: "gpt-5.6-sol", effort: "high" });

    expect(first.kill).toHaveBeenCalledOnce();
    expect(service.getSnapshot(previous.sessionId)).toBeUndefined();
    expect(service.getActiveSession()).toEqual({ sessionId: current.sessionId });
  });

  it("connects the session-scoped MCP panel and returns feedback through the PTY", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-staging-"));
    roots.push(root);
    const pty = fakePty();
    const calls: Parameters<typeof spawnPty>[] = [];
    const status = {
      check: async () => ({ installed: true, authenticated: true, version: "0.144.5", authMethod: "ChatGPT" }),
    };
    const service = new ForgeSessionService(
      status,
      root,
      (...args) => {
        calls.push(args);
        return pty.value;
      },
      async () => undefined,
      { serverUrl: "http://127.0.0.1:4545", command: "/node", args: ["mcp.js"] },
    );
    const { sessionId } = await service.start({ model: "gpt-5.6-sol", effort: "medium" });
    const codexArgs = (calls[0]?.[1] ?? []) as string[];
    const config = codexArgs.find((arg) => arg.startsWith("mcp_servers.scriptforge.args="));
    const mcpArgs = JSON.parse(config?.slice(config.indexOf("=") + 1) ?? "[]") as string[];
    const token = mcpArgs[mcpArgs.indexOf("--token") + 1] ?? "";
    const events: unknown[] = [];
    service.subscribe(sessionId, (event) => events.push(event));

    expect(codexArgs).toContain("mcp_servers.scriptforge.required=true");
    expect(() => service.publishPanel(sessionId, "wrong", samplePanel())).toThrow("token");
    expect(service.publishPanel(sessionId, token, samplePanel())).toMatchObject({ version: 1, title: "Choose" });

    await writeCandidate(join(root, sessionId));
    await expect(service.publishCandidate(sessionId, token, { summary: "Ready" })).resolves.toMatchObject({
      name: "Tiny Tool",
      requiredExecutables: [],
    });
    expect(events).toContainEqual({ type: "candidate", candidate: expect.objectContaining({ name: "Tiny Tool" }) });

    vi.useFakeTimers();
    try {
      service.sendFeedback(sessionId, "Use PNG");
      expect(pty.write).toHaveBeenCalledWith("\x1b[200~Use PNG\x1b[201~");
      expect(events).toContainEqual({ type: "panel", panel: null });
      await vi.advanceTimersByTimeAsync(50);
      expect(pty.write).toHaveBeenCalledWith("\r");
    } finally {
      vi.useRealTimers();
    }
  });
});

function samplePanel() {
  return {
    title: "Choose",
    blocks: [
      {
        id: "format",
        type: "question" as const,
        prompt: "Which format?",
        input: {
          kind: "single_choice" as const,
          name: "format",
          required: true,
          options: [{ value: "png", label: "PNG" }],
        },
      },
    ],
  };
}

async function writeCandidate(directory: string) {
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
      }),
    ),
    writeFile(join(directory, "run.mjs"), 'console.log("ready")'),
    writeFile(join(directory, "ui.html"), "<!doctype html><title>Tiny Tool</title>"),
  ]);
}

function fakePty() {
  const write = vi.fn();
  const resize = vi.fn();
  const kill = vi.fn();
  const value = {
    write,
    resize,
    kill,
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    onExit: vi.fn(() => ({ dispose: vi.fn() })),
  } as unknown as IPty;
  return { value, write, resize, kill };
}
