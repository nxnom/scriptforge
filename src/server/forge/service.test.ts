import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IPty, spawn as spawnPty } from "node-pty";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForgeSessionService } from "./service";
import { ForgeSessionStore } from "./session-store";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Forge terminal sessions", () => {
  it("spawns Codex in staging without overriding the user's permission settings", async () => {
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
    expect(args).toEqual(expect.arrayContaining(["-m", "gpt-5.6-sol", "--cd", join(root, sessionId)]));
    expect(args).not.toContain("--sandbox");
    expect(args).not.toContain("--ask-for-approval");
    expect(args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
    expect(options.cwd).toBe(join(root, sessionId));
    expect(options.env?.TERM).toBe("xterm-256color");
    expect(trust).toHaveBeenCalledWith(join(root, sessionId));

    service.write(sessionId, "hello");
    service.resize(sessionId, 120, 40);
    expect(pty.write).toHaveBeenCalledWith("hello");
    expect(pty.resize).toHaveBeenCalledWith(120, 40);
  });

  it("passes the approval and sandbox bypass only after explicit opt-in", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-staging-"));
    roots.push(root);
    const pty = fakePty();
    const spawn = vi.fn((..._args: Parameters<typeof spawnPty>) => pty.value);
    const service = new ForgeSessionService(
      { check: async () => ({ installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" }) },
      root,
      spawn,
      async () => undefined,
    );

    await service.start({
      model: "gpt-5.6-sol",
      effort: "medium",
      dangerouslyBypassApprovalsAndSandbox: true,
    });

    expect(spawn.mock.calls[0]?.[1]).toContain("--dangerously-bypass-approvals-and-sandbox");
  });

  it("starts an installed-tool update from a staged copy with update-specific instructions", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-staging-"));
    roots.push(root);
    const installed = join(root, "installed-tool");
    const staging = join(root, "staging");
    await mkdir(installed);
    await Promise.all([
      writeFile(join(installed, "tool.json"), '{"id":"installed-tool"}'),
      writeFile(join(installed, "run.mjs"), 'console.log("installed")'),
      writeFile(join(installed, "ui.html"), "<title>Installed</title>"),
    ]);
    const pty = fakePty();
    const calls: Parameters<typeof spawnPty>[] = [];
    const service = new ForgeSessionService(
      { check: async () => ({ installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" }) },
      staging,
      (...args) => {
        calls.push(args);
        return pty.value;
      },
      async () => undefined,
      { serverUrl: "http://127.0.0.1:4545", command: "node", args: ["mcp.js"] },
    );

    const { sessionId } = await service.start(
      { model: "gpt-5.6-sol", effort: "medium" },
      { id: "installed-tool", name: "Installed Tool", directory: installed },
    );

    await expect(readFile(join(staging, sessionId, "ui.html"), "utf8")).resolves.toContain("Installed");
    expect(service.getActiveSession()).toEqual({
      sessionId: null,
      toolId: null,
      sessions: [{ sessionId, toolId: "installed-tool", scope: "update" }],
    });
    expect(((calls[0]?.[1] ?? []) as string[]).find((arg) => arg.startsWith("developer_instructions="))).toContain(
      "This session updates the installed tool",
    );
  });

  it("pre-authorizes required candidate dependencies only in bypass instructions", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-staging-"));
    roots.push(root);
    const pty = fakePty();
    const calls: Parameters<typeof spawnPty>[] = [];
    const service = new ForgeSessionService(
      { check: async () => ({ installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" }) },
      root,
      (...args) => {
        calls.push(args);
        return pty.value;
      },
      async () => undefined,
      { serverUrl: "http://127.0.0.1:4545", command: "node", args: ["mcp.js"] },
    );

    await service.start({
      model: "gpt-5.6-sol",
      effort: "medium",
      dangerouslyBypassApprovalsAndSandbox: true,
    });

    const args = (calls[0]?.[1] ?? []) as string[];
    const instructions = args.find((arg) => arg.startsWith("developer_instructions="));
    const mcpConfig = args.find((arg) => arg.startsWith("mcp_servers.scriptforge.args="));
    const mcpArgs = JSON.parse(mcpConfig?.slice(mcpConfig.indexOf("=") + 1) ?? "[]") as string[];
    expect(instructions).toContain("run it without asking for permission again");
    expect(instructions).toContain("try reasonable verified installation alternatives");
    expect(instructions).toContain("brew info, apt-cache policy, winget show, or npm view");
    expect(instructions).not.toContain("Never install silently");
    expect(mcpArgs).toContain("--allow-dependency-installs");
    expect(mcpArgs[mcpArgs.indexOf("--allow-dependency-installs") + 1]).toBe("true");
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

    expect(service.getActiveSession()).toEqual({
      sessionId,
      toolId: null,
      sessions: [{ sessionId, toolId: null, scope: "create" }],
    });
    expect(pty.kill).not.toHaveBeenCalled();
  });

  it("stops the active terminal explicitly", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-staging-"));
    roots.push(root);
    const pty = fakePty();
    const service = new ForgeSessionService(
      { check: async () => ({ installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" }) },
      root,
      () => pty.value,
      async () => undefined,
    );
    const { sessionId } = await service.start({ model: "gpt-5.6-sol", effort: "medium" });

    expect(await service.stop(sessionId)).toBe(true);
    expect(pty.kill).toHaveBeenCalledOnce();
    expect(service.getActiveSession()).toEqual({ sessionId: null, toolId: null, sessions: [] });
    expect(await service.stop(sessionId)).toBe(false);
  });

  it("keeps one create session and one update session per tool active concurrently", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-staging-"));
    roots.push(root);
    const alpha = join(root, "alpha");
    const beta = join(root, "beta");
    await Promise.all([writeUpdateSource(alpha, "Alpha"), writeUpdateSource(beta, "Beta")]);
    const createPty = fakePty();
    const alphaPty = fakePty();
    const betaPty = fakePty();
    const ptys = [createPty.value, alphaPty.value, betaPty.value];
    const status = {
      check: async () => ({ installed: true, authenticated: true, version: "0.144.5", authMethod: "ChatGPT" }),
    };
    const service = new ForgeSessionService(
      status,
      join(root, "staging"),
      () => ptys.shift() as IPty,
      async () => undefined,
    );
    const create = await service.start({ model: "gpt-5.6-sol", effort: "medium" });
    const updateAlpha = await service.start(
      { model: "gpt-5.6-sol", effort: "high" },
      { id: "alpha", name: "Alpha", directory: alpha },
    );
    const updateBeta = await service.start(
      { model: "gpt-5.6-sol", effort: "low" },
      { id: "beta", name: "Beta", directory: beta },
    );

    expect(createPty.kill).not.toHaveBeenCalled();
    expect(alphaPty.kill).not.toHaveBeenCalled();
    expect(service.getSnapshot(create.sessionId)).toBeDefined();
    expect(service.getSnapshot(updateAlpha.sessionId)).toBeDefined();
    expect(service.getActiveSession()).toEqual({
      sessionId: create.sessionId,
      toolId: null,
      sessions: [
        { sessionId: create.sessionId, toolId: null, scope: "create" },
        { sessionId: updateAlpha.sessionId, toolId: "alpha", scope: "update" },
        { sessionId: updateBeta.sessionId, toolId: "beta", scope: "update" },
      ],
    });
    await expect(service.start({ model: "gpt-5.6-sol", effort: "medium" })).rejects.toThrow(
      "new-tool session is already active",
    );
    await expect(
      service.start({ model: "gpt-5.6-sol", effort: "medium" }, { id: "alpha", name: "Alpha", directory: alpha }),
    ).rejects.toThrow("update session for Alpha is already active");

    expect(await service.stop(updateAlpha.sessionId)).toBe(true);
    expect(alphaPty.kill).toHaveBeenCalledOnce();
    expect(createPty.kill).not.toHaveBeenCalled();
    expect(betaPty.kill).not.toHaveBeenCalled();
    expect(service.getActiveSession().sessions).toHaveLength(2);
  });

  it("persists a stopped draft and resumes the exact Codex conversation after restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-staging-"));
    roots.push(root);
    const codexRoot = join(root, "codex-sessions");
    const store = new ForgeSessionStore(root, join(root, ".sessions"), codexRoot);
    const firstPty = fakePty();
    const status = {
      check: async () => ({ installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" }),
    };
    const firstService = new ForgeSessionService(
      status,
      root,
      () => firstPty.value,
      async () => undefined,
      undefined,
      async () => [],
      store,
    );
    const { sessionId } = await firstService.start({ model: "gpt-5.6-sol", effort: "medium" });
    await writeCandidate(join(root, sessionId));
    const codexSessionId = "019f7df3-9b93-7411-a9a1-44b1dc4a8be8";
    await mkdir(codexRoot, { recursive: true });
    await writeFile(
      join(codexRoot, "rollout.jsonl"),
      `${JSON.stringify({
        type: "session_meta",
        payload: {
          session_id: codexSessionId,
          cwd: join(root, sessionId),
          timestamp: new Date().toISOString(),
        },
      })}\n`,
    );

    expect(await firstService.stop(sessionId)).toBe(true);
    await expect(firstService.getResumableSessions()).resolves.toEqual([
      expect.objectContaining({
        sessionId,
        name: "Tiny Tool",
        status: "stopped",
        resumable: true,
      }),
    ]);

    const resumedPty = fakePty();
    const calls: Parameters<typeof spawnPty>[] = [];
    const resumedService = new ForgeSessionService(
      status,
      root,
      (...args) => {
        calls.push(args);
        return resumedPty.value;
      },
      async () => undefined,
      undefined,
      async () => [],
      store,
    );

    await expect(resumedService.resume(sessionId, { model: "gpt-5.6-sol", effort: "high" })).resolves.toEqual({
      sessionId,
    });
    expect(calls[0]?.[1]).toEqual(expect.arrayContaining(["resume", codexSessionId, "--cd", join(root, sessionId)]));
    expect(resumedService.getActiveSession().sessionId).toBe(sessionId);
  });

  it("discards only an inactive saved Forge session", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-staging-"));
    roots.push(root);
    const service = new ForgeSessionService(
      { check: async () => ({ installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" }) },
      root,
      () => fakePty().value,
      async () => undefined,
    );
    const { sessionId } = await service.start({ model: "gpt-5.6-sol", effort: "medium" });
    await writeCandidate(join(root, sessionId));
    await expect(service.discard(sessionId)).rejects.toThrow("Stop this Forge session");
    await service.stop(sessionId);
    await expect(service.discard(sessionId)).resolves.toBe(true);
    await expect(readFile(join(root, sessionId, "tool.json"))).rejects.toThrow();
    await expect(service.discard(sessionId)).resolves.toBe(false);
  });

  it("stops and removes a temporary workspace when discard is requested", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-staging-"));
    roots.push(root);
    const service = new ForgeSessionService(
      { check: async () => ({ installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" }) },
      root,
      () => fakePty().value,
      async () => undefined,
    );
    const { sessionId } = await service.start({ model: "gpt-5.6-sol", effort: "medium" });
    await writeCandidate(join(root, sessionId));

    await expect(service.stop(sessionId, true)).resolves.toBe(true);
    await expect(readFile(join(root, sessionId, "tool.json"))).rejects.toThrow();
    await expect(service.getResumableSessions()).resolves.toEqual([]);
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
      async () => ["Files", "Images"],
    );
    const { sessionId } = await service.start({ model: "gpt-5.6-sol", effort: "medium" });
    const codexArgs = (calls[0]?.[1] ?? []) as string[];
    const config = codexArgs.find((arg) => arg.startsWith("mcp_servers.scriptforge.args="));
    const instructions = codexArgs.find((arg) => arg.startsWith("developer_instructions="));
    const mcpArgs = JSON.parse(config?.slice(config.indexOf("=") + 1) ?? "[]") as string[];
    const token = mcpArgs[mcpArgs.indexOf("--token") + 1] ?? "";
    const events: unknown[] = [];
    service.subscribe(sessionId, (event) => events.push(event));

    expect(codexArgs).toContain("mcp_servers.scriptforge.required=true");
    expect(instructions).toContain("Existing ScriptForge categories on this machine: Files, Images");
    expect(() => service.publishPanel(sessionId, "wrong", samplePanel())).toThrow("token");
    expect(service.publishPanel(sessionId, token, samplePanel())).toMatchObject({ version: 1, title: "Choose" });

    await writeCandidate(join(root, sessionId));
    await expect(
      service.publishCandidate(sessionId, token, {
        summary: "Ready",
        testSummary: "Processed a sample successfully.",
      }),
    ).resolves.toMatchObject({
      name: "Tiny Tool",
      requiredExecutables: [],
      testSummary: "Processed a sample successfully.",
    });
    expect(events).toContainEqual({ type: "candidate", candidate: expect.objectContaining({ name: "Tiny Tool" }) });
    const presented = events.find(
      (event): event is { type: "candidate"; candidate: { revision: string } } =>
        typeof event === "object" && event !== null && "type" in event && event.type === "candidate",
    );
    await expect(service.getCandidateRuntime(sessionId, presented?.candidate.revision ?? "")).resolves.toMatchObject({
      directory: join(root, sessionId),
      manifest: { id: "tiny-tool", script: "run.mjs" },
    });
    await writeFile(join(root, sessionId, "run.mjs"), 'console.log("changed")');
    await expect(service.getCandidateRuntime(sessionId, presented?.candidate.revision ?? "")).rejects.toThrow(
      "changed after it was presented",
    );

    vi.useFakeTimers();
    try {
      service.sendFeedback(sessionId, 1, "Use PNG");
      expect(pty.write).toHaveBeenCalledWith("\x1b[200~Use PNG\x1b[201~");
      expect(events).toContainEqual({ type: "panel", panel: null });
      expect(service.getSnapshot(sessionId)?.events.some((event) => event.type === "panel")).toBe(false);
      expect(() => service.sendFeedback(sessionId, 1, "Use PNG again")).toThrow("already answered");
      expect(pty.write).toHaveBeenCalledTimes(1);
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
          defaultValue: "png",
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

async function writeUpdateSource(directory: string, name: string) {
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, "tool.json"), JSON.stringify({ id: name.toLowerCase() })),
    writeFile(join(directory, "run.mjs"), 'console.log("ready")'),
    writeFile(join(directory, "ui.html"), `<title>${name}</title>`),
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
