import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type IPty, spawn as spawnPty } from "node-pty";
import { forgeMcpInstructions } from "../../mcp/instructions";
import { toolManifestSchema } from "../../tools/manifest";
import { type CodexStatusChecker, CodexStatusService } from "../codex/status";
import { ensureCodexTrusted } from "../codex/trust";
import { readForgeCandidate } from "./candidate";
import type {
  ForgeCandidateDocument,
  ForgeCandidateRequest,
  ForgePanelRequest,
  ForgePreferences,
  ForgeServerEvent,
} from "./types";

type Listener = (event: ForgeServerEvent) => void;
type PtyFactory = typeof spawnPty;
type TrustDirectory = (directory: string) => Promise<void>;

export type ForgeMcpRuntime = {
  serverUrl: string;
  command: string;
  args: string[];
};

type ForgeSession = {
  id: string;
  pty: IPty;
  history: ForgeServerEvent[];
  listeners: Set<Listener>;
  exited: boolean;
  mcpToken: string;
  panelVersion: number;
  openPanelVersion?: number;
  directory: string;
  candidate?: ForgeCandidateDocument;
  candidateJobs: Map<string, string>;
};

export class ForgeSessionService {
  private session?: ForgeSession;

  constructor(
    private readonly codexStatus: CodexStatusChecker = new CodexStatusService(),
    private readonly stagingRoot = join(homedir(), ".scriptforge", "staging"),
    private readonly spawn: PtyFactory = spawnPty,
    private readonly trust: TrustDirectory = ensureCodexTrusted,
    private readonly mcpRuntime?: ForgeMcpRuntime,
  ) {}

  async start(preferences: ForgePreferences) {
    const readiness = await this.codexStatus.check();
    if (!readiness.installed) throw new Error("Install the Codex CLI before starting Forge.");
    if (!readiness.authenticated) throw new Error("Run codex login before starting Forge.");

    if (this.session && !this.session.exited) this.stop(this.session.id);

    const id = randomUUID();
    const mcpToken = randomUUID();
    const directory = join(this.stagingRoot, id);
    await mkdir(directory, { recursive: true });
    await this.trust(directory);
    const pty = this.spawn(codexCommand(), codexArgs(preferences, directory, this.mcpRuntime, id, mcpToken), {
      name: "xterm-256color",
      cols: 100,
      rows: 30,
      cwd: directory,
      env: { ...(process.env as Record<string, string>), TERM: "xterm-256color" },
    });
    const session: ForgeSession = {
      id,
      pty,
      history: [],
      listeners: new Set(),
      exited: false,
      mcpToken,
      panelVersion: 0,
      directory,
      candidateJobs: new Map(),
    };
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

  publishPanel(sessionId: string, token: string, request: ForgePanelRequest) {
    const session = this.activeSession(sessionId);
    if (token !== session.mcpToken) throw new Error("Invalid Forge MCP token.");
    session.panelVersion += 1;
    const panel = { ...request, version: session.panelVersion, createdAt: Date.now() };
    session.openPanelVersion = panel.version;
    this.emit(session, { type: "panel", panel });
    return panel;
  }

  async publishCandidate(sessionId: string, token: string, request: ForgeCandidateRequest) {
    const session = this.activeSession(sessionId);
    if (token !== session.mcpToken) throw new Error("Invalid Forge MCP token.");
    const candidate = await readForgeCandidate(session.directory, request);
    session.candidate = candidate;
    this.emit(session, { type: "candidate", candidate });
    return candidate;
  }

  async getCandidateRuntime(sessionId: string, revision: string) {
    const session = this.activeSession(sessionId);
    const candidate = session.candidate;
    if (!candidate || candidate.revision !== revision) throw new Error("That candidate revision is no longer current.");
    const current = await readForgeCandidate(session.directory, {
      summary: candidate.summary,
      testSummary: candidate.testSummary,
      risks: candidate.risks,
    });
    if (current.revision !== revision)
      throw new Error("The candidate changed after it was presented. Present it again.");
    return {
      directory: session.directory,
      manifest: toolManifestSchema.parse(JSON.parse(current.manifestSource)),
      candidate: current,
    };
  }

  trackCandidateJob(sessionId: string, revision: string, jobId: string) {
    const session = this.activeSession(sessionId);
    if (session.candidate?.revision !== revision) throw new Error("That candidate revision is no longer current.");
    session.candidateJobs.set(revision, jobId);
  }

  getCandidateJob(sessionId: string, revision: string) {
    return this.activeSession(sessionId).candidateJobs.get(revision);
  }

  sendFeedback(sessionId: string, panelVersion: number, text: string, dismiss = true) {
    const session = this.activeSession(sessionId);
    if (session.openPanelVersion !== panelVersion) throw new Error("That Forge question was already answered.");
    session.openPanelVersion = undefined;
    session.pty.write(`\x1b[200~${text}\x1b[201~`);
    if (dismiss) {
      this.emit(session, { type: "panel", panel: null });
    }
    setTimeout(() => {
      if (!session.exited) session.pty.write("\r");
    }, 50).unref();
  }

  stop(sessionId: string) {
    const session = this.find(sessionId);
    if (!session || session.exited) return false;
    session.pty.kill();
    session.exited = true;
    return true;
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

function codexArgs(
  preferences: ForgePreferences,
  directory: string,
  mcpRuntime: ForgeMcpRuntime | undefined,
  sessionId: string,
  token: string,
) {
  const args = ["-c", `model_reasoning_effort=${preferences.effort}`, "-m", preferences.model, "--cd", directory];
  if (!mcpRuntime) return args;
  const mcpArgs = [
    ...mcpRuntime.args,
    "--server-url",
    mcpRuntime.serverUrl,
    "--session-id",
    sessionId,
    "--token",
    token,
  ];
  return [
    ...args,
    "-c",
    `developer_instructions=${JSON.stringify(forgeMcpInstructions)}`,
    "-c",
    `mcp_servers.scriptforge.command=${JSON.stringify(mcpRuntime.command)}`,
    "-c",
    `mcp_servers.scriptforge.args=${JSON.stringify(mcpArgs)}`,
    "-c",
    "mcp_servers.scriptforge.required=true",
    "-c",
    'mcp_servers.scriptforge.enabled_tools=["scriptforge_show_panel","scriptforge_present_candidate"]',
  ];
}
