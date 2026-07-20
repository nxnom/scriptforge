import { randomUUID } from "node:crypto";
import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type IPty, spawn as spawnPty } from "node-pty";
import { createForgeMcpInstructions } from "../../mcp/instructions";
import { toolManifestSchema } from "../../tools/manifest";
import { type CodexStatusChecker, CodexStatusService } from "../codex/status";
import { ensureCodexTrusted } from "../codex/trust";
import { readForgeCandidate } from "./candidate";
import { createPersistedSession, ForgeSessionStore, withCandidateRequest } from "./session-store";
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
type CategoryProvider = () => Promise<string[]>;

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
  toolId?: string;
  scope: "create" | "update";
  stopRequested: boolean;
  discardRequested: boolean;
};

export type ForgeUpdateTarget = {
  id: string;
  name: string;
  directory: string;
};

export class ForgeSessionService {
  private readonly sessions = new Map<string, ForgeSession>();

  constructor(
    private readonly codexStatus: CodexStatusChecker = new CodexStatusService(),
    private readonly stagingRoot = join(homedir(), ".scriptforge", "staging"),
    private readonly spawn: PtyFactory = spawnPty,
    private readonly trust: TrustDirectory = ensureCodexTrusted,
    private readonly mcpRuntime?: ForgeMcpRuntime,
    private readonly categories: CategoryProvider = async () => [],
    private readonly store = new ForgeSessionStore(stagingRoot),
  ) {}

  async start(preferences: ForgePreferences, updateTarget?: ForgeUpdateTarget) {
    const readiness = await this.codexStatus.check();
    if (!readiness.installed) throw new Error("Install the Codex CLI before starting Forge.");
    if (!readiness.authenticated) throw new Error("Run codex login before starting Forge.");

    const conflicting = this.activeSessions().find((session) =>
      updateTarget ? session.scope === "update" && session.toolId === updateTarget.id : session.scope === "create",
    );
    if (conflicting) {
      throw new Error(
        updateTarget
          ? `An update session for ${updateTarget.name} is already active.`
          : "A new-tool session is already active.",
      );
    }

    const id = randomUUID();
    const mcpToken = randomUUID();
    const directory = join(this.stagingRoot, id);
    await mkdir(directory, { recursive: true });
    if (updateTarget) {
      await Promise.all(
        ["tool.json", "run.mjs", "ui.html"].map((file) =>
          copyFile(join(updateTarget.directory, file), join(directory, file)),
        ),
      );
    }
    await this.trust(directory);
    const existingCategories = await this.categories().catch(() => []);
    const persisted = createPersistedSession(
      id,
      updateTarget ? "update" : "create",
      updateTarget?.id,
      updateTarget?.name,
    );
    await this.store.save(persisted);
    const pty = this.spawn(
      codexCommand(),
      codexArgs(preferences, directory, this.mcpRuntime, id, mcpToken, existingCategories, updateTarget),
      {
        name: "xterm-256color",
        cols: 100,
        rows: 30,
        cwd: directory,
        env: { ...(process.env as Record<string, string>), TERM: "xterm-256color" },
      },
    );
    const session: ForgeSession = {
      id,
      pty,
      history: [],
      listeners: new Set(),
      exited: false,
      mcpToken,
      panelVersion: 0,
      directory,
      toolId: updateTarget?.id,
      scope: updateTarget ? "update" : "create",
      stopRequested: false,
      discardRequested: false,
    };
    this.sessions.set(session.id, session);
    pty.onData((data) => this.emit(session, { type: "output", data }));
    pty.onExit(({ exitCode, signal }) => {
      session.exited = true;
      this.emit(session, { type: "exit", exitCode, signal });
      void this.persistExit(session);
    });
    return { sessionId: id };
  }

  getSnapshot(sessionId: string) {
    const session = this.find(sessionId);
    return session ? { events: [...session.history], exited: session.exited } : undefined;
  }

  getActiveSession() {
    const sessions = this.activeSessions().map((session) => ({
      sessionId: session.id,
      toolId: session.toolId ?? null,
      scope: session.scope,
    }));
    const createSession = sessions.find((session) => session.scope === "create");
    return {
      sessionId: createSession?.sessionId ?? null,
      toolId: createSession?.toolId ?? null,
      sessions,
    };
  }

  async getResumableSessions() {
    return this.store.list(new Set(this.activeSessions().map((session) => session.id)));
  }

  async resume(sessionId: string, preferences: ForgePreferences) {
    const readiness = await this.codexStatus.check();
    if (!readiness.installed) throw new Error("Install the Codex CLI before resuming Forge.");
    if (!readiness.authenticated) throw new Error("Run codex login before resuming Forge.");
    const persisted = await this.store.get(sessionId);
    if (!persisted) throw new Error("That saved Forge session does not exist.");
    const conflicting = this.activeSessions().find((session) =>
      persisted.scope === "update"
        ? session.scope === "update" && session.toolId === persisted.toolId
        : session.scope === "create",
    );
    if (conflicting) throw new Error("Another Forge session is already active for that workspace.");
    const codexSessionId = await this.store.resolveCodexSessionId(sessionId);
    if (!codexSessionId) throw new Error("The matching Codex conversation could not be found.");

    const directory = join(this.stagingRoot, sessionId);
    await this.trust(directory);
    const mcpToken = randomUUID();
    const existingCategories = await this.categories().catch(() => []);
    const updateTarget = persisted.toolId
      ? { id: persisted.toolId, name: persisted.toolName ?? persisted.toolId, directory }
      : undefined;
    const pty = this.spawn(
      codexCommand(),
      codexArgs(
        preferences,
        directory,
        this.mcpRuntime,
        sessionId,
        mcpToken,
        existingCategories,
        updateTarget,
        codexSessionId,
      ),
      {
        name: "xterm-256color",
        cols: 100,
        rows: 30,
        cwd: directory,
        env: { ...(process.env as Record<string, string>), TERM: "xterm-256color" },
      },
    );
    const candidate = persisted.candidateRequest
      ? await readForgeCandidate(directory, persisted.candidateRequest).catch(() => undefined)
      : undefined;
    const session: ForgeSession = {
      id: sessionId,
      pty,
      history: candidate ? [{ type: "candidate", candidate }] : [],
      listeners: new Set(),
      exited: false,
      mcpToken,
      panelVersion: 0,
      directory,
      candidate,
      toolId: persisted.toolId ?? undefined,
      scope: persisted.scope,
      stopRequested: false,
      discardRequested: false,
    };
    this.sessions.set(session.id, session);
    pty.onData((data) => this.emit(session, { type: "output", data }));
    pty.onExit(({ exitCode, signal }) => {
      session.exited = true;
      this.emit(session, { type: "exit", exitCode, signal });
      void this.persistExit(session);
    });
    await this.store.save({ ...persisted, codexSessionId, status: "running", updatedAt: Date.now() });
    return { sessionId };
  }

  getTargetToolId(sessionId: string) {
    return this.activeSession(sessionId).toolId;
  }

  markSaved(sessionId: string, toolId: string) {
    const session = this.activeSession(sessionId);
    session.toolId = toolId;
    void this.store.get(sessionId).then((persisted) =>
      persisted
        ? this.store.save({
            ...persisted,
            toolId,
            toolName: session.candidate?.name ?? persisted.toolName,
            updatedAt: Date.now(),
          })
        : undefined,
    );
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
    this.removePanelHistory(session);
    this.emit(session, { type: "panel", panel });
    return panel;
  }

  async publishCandidate(sessionId: string, token: string, request: ForgeCandidateRequest) {
    const session = this.activeSession(sessionId);
    if (token !== session.mcpToken) throw new Error("Invalid Forge MCP token.");
    const candidate = await readForgeCandidate(session.directory, request);
    session.candidate = candidate;
    const persisted = await this.store.get(sessionId);
    if (persisted) await this.store.save(withCandidateRequest(persisted, request));
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

  sendFeedback(sessionId: string, panelVersion: number, text: string, dismiss = true) {
    const session = this.activeSession(sessionId);
    if (session.openPanelVersion !== panelVersion) throw new Error("That Forge question was already answered.");
    session.openPanelVersion = undefined;
    this.removePanelHistory(session);
    session.pty.write(`\x1b[200~${text}\x1b[201~`);
    if (dismiss) {
      this.broadcast(session, { type: "panel", panel: null });
    }
    setTimeout(() => {
      if (!session.exited) session.pty.write("\r");
    }, 50).unref();
  }

  async stop(sessionId: string, discard = false) {
    const session = this.find(sessionId);
    if (!session || session.exited) return false;
    session.stopRequested = true;
    session.discardRequested = discard;
    if (!discard) {
      const persisted = await this.store.get(sessionId);
      if (persisted) await this.store.save({ ...persisted, status: "stopped", updatedAt: Date.now() });
    }
    session.pty.kill();
    session.exited = true;
    if (discard) {
      await this.store.delete(sessionId);
      this.sessions.delete(sessionId);
    }
    return true;
  }

  async discard(sessionId: string) {
    const active = this.find(sessionId);
    if (active && !active.exited) throw new Error("Stop this Forge session before discarding it.");
    const persisted = await this.store.get(sessionId);
    if (!persisted) return false;
    await this.store.delete(sessionId);
    this.sessions.delete(sessionId);
    return true;
  }

  private activeSession(sessionId: string) {
    const session = this.find(sessionId);
    if (!session || session.exited) throw new Error("That Forge terminal is no longer active.");
    return session;
  }

  private find(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  private activeSessions() {
    return [...this.sessions.values()].filter((session) => !session.exited);
  }

  private emit(session: ForgeSession, event: ForgeServerEvent) {
    session.history.push(event);
    if (session.history.length > 1_000) session.history.shift();
    this.broadcast(session, event);
  }

  private broadcast(session: ForgeSession, event: ForgeServerEvent) {
    for (const listener of session.listeners) listener(event);
  }

  private removePanelHistory(session: ForgeSession) {
    session.history = session.history.filter((event) => event.type !== "panel");
  }

  private async persistExit(session: ForgeSession) {
    if (session.discardRequested) return;
    const persisted = await this.store.get(session.id).catch(() => undefined);
    if (!persisted) return;
    const codexSessionId = persisted.codexSessionId ?? (await this.store.resolveCodexSessionId(session.id));
    await this.store
      .save({
        ...persisted,
        codexSessionId,
        status: session.stopRequested ? "stopped" : "interrupted",
        updatedAt: Date.now(),
      })
      .catch(() => undefined);
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
  existingCategories: string[],
  updateTarget?: ForgeUpdateTarget,
  resumeSessionId?: string,
) {
  const args = [
    ...(resumeSessionId ? ["resume", resumeSessionId] : []),
    "-c",
    `model_reasoning_effort=${preferences.effort}`,
    "-m",
    preferences.model,
    "--cd",
    directory,
  ];
  if (preferences.dangerouslyBypassApprovalsAndSandbox) {
    args.push("--dangerously-bypass-approvals-and-sandbox");
  }
  if (!mcpRuntime) return args;
  const mcpArgs = [
    ...mcpRuntime.args,
    "--server-url",
    mcpRuntime.serverUrl,
    "--session-id",
    sessionId,
    "--token",
    token,
    "--allow-dependency-installs",
    String(preferences.dangerouslyBypassApprovalsAndSandbox === true),
  ];
  const instructions = createForgeMcpInstructions({
    allowDependencyInstalls: preferences.dangerouslyBypassApprovalsAndSandbox === true,
  });
  const updateInstructions = updateTarget
    ? `\n\nThis session updates the installed tool ${JSON.stringify(updateTarget.name)} (${updateTarget.id}). Its current tool.json, run.mjs, and ui.html are already in the staging directory. Preserve its manifest id exactly. Ask what the user wants changed, use the question panel only for unresolved decisions, then follow the standalone-check, presentation, Preview-test, and Save workflow. Do not rebuild or alter unrelated behavior unless requested.`
    : "";
  return [
    ...args,
    "-c",
    `developer_instructions=${JSON.stringify(`${instructions}${updateInstructions}\n\nExisting ScriptForge categories on this machine: ${existingCategories.length ? existingCategories.join(", ") : "none yet"}.`)}`,
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
