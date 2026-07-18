import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IPty, spawn as spawnPty } from "node-pty";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequirementService } from "../requirements/service";
import { DoctorSessionService } from "./service";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Codex Doctor sessions", () => {
  it("starts only on request and executes only the exact approved proposal", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-doctor-"));
    roots.push(root);
    await writeTool(root);
    let installed = false;
    const requirements = new RequirementService(async () =>
      installed ? { found: true, version: "7.1.0" } : { found: false, version: null },
    );
    const codex = controllablePty();
    const installer = controllablePty();
    const ptys = [codex.value, installer.value];
    const calls: Parameters<typeof spawnPty>[] = [];
    const service = new DoctorSessionService(
      { check: async () => ({ installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" }) },
      requirements,
      root,
      undefined,
      join(root, "sessions"),
      (...args) => {
        calls.push(args);
        return ptys.shift() as IPty;
      },
      async () => undefined,
      { serverUrl: "http://127.0.0.1:4545", command: "node", args: ["mcp.js"] },
    );

    expect(calls).toHaveLength(0);
    const { sessionId } = await service.start("video-tool", { model: "gpt-5.6-sol", effort: "medium" });
    expect(service.getActiveSession()).toEqual({ sessionId, toolId: "video-tool" });
    expect(calls).toHaveLength(1);
    const token = doctorToken(calls[0]?.[1] ?? []);
    expect(() => service.propose(sessionId, "wrong", proposal())).toThrow("token");
    service.propose(sessionId, token, proposal());
    expect(calls).toHaveLength(1);

    const events: unknown[] = [];
    service.subscribe(sessionId, (event) => events.push(event));
    service.approve(sessionId);
    expect(events).toContainEqual({ type: "proposal", proposal: null });
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]?.[0]).toBe("brew");
    expect(calls[1]?.[1]).toEqual(["install", "ffmpeg"]);
    installed = true;
    installer.exit(0);

    await expect
      .poll(() => events)
      .toContainEqual({
        type: "verification",
        ready: true,
        message: "Every required executable is now available.",
      });
    service.stop(sessionId);
    expect(service.getActiveSession()).toEqual({ sessionId: null, toolId: null });
  });
});

function proposal() {
  return {
    summary: "Install ffmpeg with Homebrew.",
    commands: [{ command: "brew", args: ["install", "ffmpeg"], explanation: "Installs ffmpeg." }],
  };
}

function doctorToken(value: string | string[]) {
  const args = typeof value === "string" ? [value] : value;
  const config = args.find((arg) => arg.startsWith("mcp_servers.scriptforge_doctor.args="));
  const mcpArgs = JSON.parse(config?.slice(config.indexOf("=") + 1) ?? "[]") as string[];
  return mcpArgs[mcpArgs.indexOf("--token") + 1] ?? "";
}

async function writeTool(root: string) {
  const directory = join(root, "video-tool");
  await mkdir(directory);
  await Promise.all([
    writeFile(
      join(directory, "tool.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "video-tool",
        version: "1.0.0",
        name: "Video Tool",
        description: "Converts video.",
        category: "Video",
        icon: "video",
        script: "run.mjs",
        interface: { type: "html", entry: "ui.html" },
        requiredExecutables: [{ name: "ffmpeg", version: ">= 7.0.0" }],
      }),
    ),
    writeFile(join(directory, "run.mjs"), ""),
    writeFile(join(directory, "ui.html"), "<!doctype html>"),
  ]);
}

function controllablePty() {
  let exitListener: ((event: { exitCode: number; signal?: number }) => void) | undefined;
  const value = {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    onExit: vi.fn((listener) => {
      exitListener = listener;
      return { dispose: vi.fn() };
    }),
  } as unknown as IPty;
  return { value, exit: (exitCode: number) => exitListener?.({ exitCode }) };
}
