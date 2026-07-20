import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ForgeSessionStore } from "./session-store";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ForgeSessionStore", () => {
  it("discovers a legacy staging folder from its exact Codex session metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-drafts-"));
    roots.push(root);
    const staging = join(root, "staging");
    const metadata = join(root, "forge-sessions");
    const codexSessions = join(root, "codex", "sessions", "2026", "07", "20");
    const sessionId = "d2b4af99-5e48-43bf-8af4-7c700e5405b1";
    const codexSessionId = "019f7df3-9b93-7411-a9a1-44b1dc4a8be8";
    const directory = join(staging, sessionId);
    await Promise.all([mkdir(directory, { recursive: true }), mkdir(codexSessions, { recursive: true })]);
    await writeFile(join(directory, "tool.json"), JSON.stringify({ name: "Duplicate File Finder" }));
    await writeFile(
      join(codexSessions, "rollout.jsonl"),
      `${JSON.stringify({
        type: "session_meta",
        payload: { session_id: codexSessionId, cwd: directory, timestamp: "2026-07-20T05:15:44.915Z" },
      })}\n`,
    );
    const store = new ForgeSessionStore(staging, metadata, join(root, "codex", "sessions"));

    await expect(store.list(new Set())).resolves.toEqual([
      expect.objectContaining({
        sessionId,
        name: "Duplicate File Finder",
        status: "interrupted",
        resumable: true,
      }),
    ]);
    await expect(store.resolveCodexSessionId(sessionId)).resolves.toBe(codexSessionId);
  });
});
