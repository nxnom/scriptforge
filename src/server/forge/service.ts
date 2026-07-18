import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type IPty, spawn as spawnPty } from "node-pty";
import { type CodexStatusChecker, CodexStatusService } from "../codex/status";
import { ensureCodexTrusted } from "../codex/trust";
import type { ForgePreferences, ForgeServerEvent } from "./types";

type Listener = (event: ForgeServerEvent) => void;
type PtyFactory = typeof spawnPty;
type TrustDirectory = (directory: string) => Promise<void>;

type ForgeSession = {
  id: string;
  pty: IPty;
  history: ForgeServerEvent[];
  listeners: Set<Listener>;
  exited: boolean;
};

export class ForgeSessionService {
  private session?: ForgeSession;

  constructor(
    private readonly codexStatus: CodexStatusChecker = new CodexStatusService(),
    private readonly stagingRoot = join(homedir(), ".scriptforge", "staging"),
    private readonly spawn: PtyFactory = spawnPty,
    private readonly trust: TrustDirectory = ensureCodexTrusted,
  ) {}

  async start(preferences: ForgePreferences) {
    const readiness = await this.codexStatus.check();
    if (!readiness.installed) throw new Error("Install the Codex CLI before starting Forge.");
    if (!readiness.authenticated) throw new Error("Run codex login before starting Forge.");

    if (this.session && !this.session.exited) this.stop(this.session.id);

    const id = randomUUID();
    const directory = join(this.stagingRoot, id);
    await mkdir(directory, { recursive: true });
    await this.trust(directory);
    const pty = this.spawn(codexCommand(), codexArgs(preferences, directory), {
      name: "xterm-256color",
      cols: 100,
      rows: 30,
      cwd: directory,
      env: { ...(process.env as Record<string, string>), TERM: "xterm-256color" },
    });
    const session: ForgeSession = { id, pty, history: [], listeners: new Set(), exited: false };
    this.session = session;
    pty.onData((data) => this.emit(session, { type: "output", data }));
    pty.onExit(({ exitCode, signal }) => {
      session.exited = true;
      this.emit(session, { type: "exit", exitCode, signal });
    });
    return { sessionId: id };
  }

  getSnapshot(sessionId: string) {
    const session = this.find(sessionId);
    return session ? { events: [...session.history], exited: session.exited } : undefined;
  }

  getActiveSession() {
    return this.session && !this.session.exited ? { sessionId: this.session.id } : { sessionId: null };
  }

  subscribe(sessionId: string, listener: Listener) {
    const session = this.find(sessionId);
    if (!session) return undefined;
    session.listeners.add(listener);
    return () => session.listeners.delete(listener);
  }

  write(sessionId: string, data: string) {
    this.activeSession(sessionId).pty.write(data);
  }

  resize(sessionId: string, cols: number, rows: number) {
    this.activeSession(sessionId).pty.resize(cols, rows);
  }

  stop(sessionId: string) {
    const session = this.find(sessionId);
    if (!session || session.exited) return;
    session.pty.kill();
  }

  private activeSession(sessionId: string) {
    const session = this.find(sessionId);
    if (!session || session.exited) throw new Error("That Forge terminal is no longer active.");
    return session;
  }

  private find(sessionId: string) {
    return this.session?.id === sessionId ? this.session : undefined;
  }

  private emit(session: ForgeSession, event: ForgeServerEvent) {
    session.history.push(event);
    if (session.history.length > 1_000) session.history.shift();
    for (const listener of session.listeners) listener(event);
  }
}

function codexCommand() {
  return process.platform === "win32" ? "codex.cmd" : "codex";
}

function codexArgs(preferences: ForgePreferences, directory: string) {
  return [
    "-c",
    `model_reasoning_effort=${preferences.effort}`,
    "-m",
    preferences.model,
    "--sandbox",
    "workspace-write",
    "--ask-for-approval",
    "on-request",
    "--cd",
    directory,
  ];
}
