import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type IPty, spawn as spawnPty } from "node-pty";
import { doctorInstructions } from "../../mcp/doctor-server.js";
import { resolveBundledToolDirectory } from "../../tools/directory";
import { defaultInstalledToolsRoot, findInstalledTool } from "../../tools/installed";
import { findBundledTool } from "../../tools/registry";
import type { CodexStatusChecker } from "../codex/status";
import { CodexStatusService } from "../codex/status";
import { ensureCodexTrusted } from "../codex/trust";
import type { ForgePreferences } from "../forge/types";
import { RequirementService } from "../requirements/service";
import type { DoctorProposal, DoctorServerEvent } from "./types";

type Listener = (event: DoctorServerEvent) => void;
type PtyFactory = typeof spawnPty;
type TrustDirectory = (directory: string) => Promise<void>;

export type DoctorMcpRuntime = { serverUrl: string; command: string; args: string[] };

type DoctorSession = {
  id: string;
  toolId: string;
  directory: string;
  pty: IPty;
  installer?: IPty;
  history: DoctorServerEvent[];
  listeners: Set<Listener>;
  exited: boolean;
  installing: boolean;
  codexDetached: boolean;
  token: string;
  proposal?: DoctorProposal;
  requirements: Array<{ name: string; version?: string }>;
};

export class DoctorSessionService {
  private session?: DoctorSession;

  constructor(
    private readonly codexStatus: CodexStatusChecker = new CodexStatusService(),
    private readonly requirements = new RequirementService(),
    private readonly installedToolsRoot = defaultInstalledToolsRoot(),
    private readonly bundledToolsRoot?: string,
    private readonly doctorRoot = join(homedir(), ".scriptforge", "doctor"),
    private readonly spawn: PtyFactory = spawnPty,
    private readonly trust: TrustDirectory = ensureCodexTrusted,
    private readonly mcpRuntime?: DoctorMcpRuntime,
  ) {}

  async start(toolId: string, preferences: ForgePreferences) {
    const readiness = await this.codexStatus.check();
    if (!readiness.installed) throw new Error("Install the Codex CLI before starting Doctor.");
    if (!readiness.authenticated) throw new Error("Run codex login before starting Doctor.");
    if (!this.mcpRuntime) throw new Error("The local Doctor MCP connection is unavailable.");

    const manifest = await this.findManifest(toolId);
    if (!manifest) throw new Error("That tool is not installed.");
    const statuses = await this.requirements.check(manifest.requiredExecutables);
    const missing = statuses.filter((status) => !status.available);
    if (!missing.length) throw new Error("This tool has no missing executable requirements.");
    if (this.session && !this.session.exited) this.stop(this.session.id);

    const id = randomUUID();
    const token = randomUUID();
    const directory = join(this.doctorRoot, id);
    await mkdir(directory, { recursive: true });
    await this.trust(directory);
    const pty = this.spawn(
      codexCommand(),
      doctorArgs(preferences, this.mcpRuntime, id, token, doctorPrompt(toolId, missing)),
      {
        name: "xterm-256color",
        cols: 100,
        rows: 30,
        cwd: directory,
        env: { ...(process.env as Record<string, string>), TERM: "xterm-256color" },
      },
    );
    const session: DoctorSession = {
      id,
      toolId,
      directory,
      pty,
      history: [],
      listeners: new Set(),
      exited: false,
      installing: false,
      codexDetached: false,
      token,
      requirements: manifest.requiredExecutables,
    };
    this.session = session;
    pty.onData((data) => {
      if (!session.codexDetached) this.emit(session, { type: "output", data });
    });
    pty.onExit(({ exitCode, signal }) => {
      if (session.codexDetached) return;
      session.exited = true;
      this.emit(session, { type: "exit", exitCode, signal });
    });
    return { sessionId: id };
  }

  getSnapshot(sessionId: string) {
    const session = this.find(sessionId);
    return session ? { events: [...session.history], exited: session.exited, toolId: session.toolId } : undefined;
  }

  getActiveSession(toolId?: string) {
    const session = this.session;
    if (!session || session.exited || (toolId && session.toolId !== toolId)) {
      return { sessionId: null, toolId: null, proposal: null };
    }
    return { sessionId: session.id, toolId: session.toolId, proposal: session.proposal ?? null };
  }

  subscribe(sessionId: string, listener: Listener) {
    const session = this.find(sessionId);
    if (!session) return;
    session.listeners.add(listener);
    return () => session.listeners.delete(listener);
  }

  write(sessionId: string, data: string) {
    const session = this.active(sessionId);
    const terminal = session.installer ?? (session.codexDetached ? undefined : session.pty);
    terminal?.write(data);
  }

  resize(sessionId: string, cols: number, rows: number) {
    const session = this.active(sessionId);
    const terminal = session.installer ?? (session.codexDetached ? undefined : session.pty);
    terminal?.resize(cols, rows);
  }

  propose(sessionId: string, token: string, proposal: Omit<DoctorProposal, "createdAt">) {
    const session = this.active(sessionId);
    if (token !== session.token) throw new Error("Invalid Doctor MCP token.");
    if (session.installing) throw new Error("Installation is already running.");
    session.proposal = { ...proposal, createdAt: Date.now() };
    this.removeProposalHistory(session);
    this.emit(session, { type: "proposal", proposal: session.proposal });
    return session.proposal;
  }

  approve(sessionId: string) {
    const session = this.active(sessionId);
    if (!session.proposal) throw new Error("There is no installation proposal to approve.");
    if (session.installing) throw new Error("Installation is already running.");
    const commands = session.proposal.commands;
    session.proposal = undefined;
    this.removeCodexHistory(session);
    this.broadcast(session, { type: "proposal", proposal: null });
    session.installing = true;
    session.codexDetached = true;
    session.pty.kill();
    this.emit(session, { type: "install-start" });
    void this.executeProposal(session, commands);
  }

  reject(sessionId: string, feedback: string) {
    const session = this.active(sessionId);
    if (!session.proposal) throw new Error("There is no installation proposal to reject.");
    session.proposal = undefined;
    this.removeProposalHistory(session);
    this.broadcast(session, { type: "proposal", proposal: null });
    paste(
      session.pty,
      `The user rejected the installation proposal.${feedback.trim() ? ` Feedback: ${feedback.trim()}` : ""} Propose safer corrected steps.`,
    );
  }

  stop(sessionId: string) {
    const session = this.find(sessionId);
    if (!session || session.exited) return false;
    session.installer?.kill();
    if (!session.codexDetached) session.pty.kill();
    session.exited = true;
    return true;
  }

  private async executeProposal(session: DoctorSession, commands: DoctorProposal["commands"]) {
    let failedCommand: string | undefined;
    for (const command of commands) {
      const exitCode = await this.executeCommand(session, command.command, command.args);
      if (exitCode !== 0) {
        failedCommand = command.command;
        break;
      }
    }
    session.installer = undefined;
    session.installing = false;
    const statuses = await this.requirements.check(session.requirements);
    const blocked = statuses.filter((status) => !status.available);
    const ready = blocked.length === 0;
    const message = ready
      ? "Every required executable is now available."
      : failedCommand
        ? `${failedCommand} exited unsuccessfully; ${blocked.map((item) => item.name).join(", ")} still needs attention.`
        : `${blocked.map((item) => item.name).join(", ")} still does not satisfy the requirement.`;
    this.emit(session, { type: "verification", ready, message });
    if (ready) {
      session.exited = true;
      this.emit(session, { type: "exit", exitCode: 0 });
    }
  }

  private executeCommand(session: DoctorSession, command: string, args: string[]) {
    return new Promise<number>((resolve, reject) => {
      this.emit(session, { type: "install-output", data: `\r\n\x1b[36m$ ${displayCommand(command, args)}\x1b[0m\r\n` });
      try {
        const installer = this.spawn(command, args, {
          name: "xterm-256color",
          cols: 100,
          rows: 30,
          cwd: session.directory,
          env: { ...(process.env as Record<string, string>), TERM: "xterm-256color" },
        });
        session.installer = installer;
        installer.onData((data) => this.emit(session, { type: "install-output", data }));
        installer.onExit(({ exitCode }) => resolve(exitCode));
      } catch (error) {
        reject(error);
      }
    }).catch((error) => {
      this.emit(session, {
        type: "install-output",
        data: `\r\n\x1b[31mCould not start ${command}: ${error instanceof Error ? error.message : "unknown error"}\x1b[0m\r\n`,
      });
      return 127;
    });
  }

  private async findManifest(toolId: string) {
    const bundled = findBundledTool(toolId);
    if (bundled) {
      resolveBundledToolDirectory(toolId, this.bundledToolsRoot);
      return bundled;
    }
    return (await findInstalledTool(toolId, this.installedToolsRoot))?.manifest;
  }

  private active(sessionId: string) {
    const session = this.find(sessionId);
    if (!session || session.exited) throw new Error("That Doctor session is no longer active.");
    return session;
  }

  private find(sessionId: string) {
    return this.session?.id === sessionId ? this.session : undefined;
  }

  private emit(session: DoctorSession, event: DoctorServerEvent) {
    session.history.push(event);
    if (session.history.length > 1_000) session.history.shift();
    this.broadcast(session, event);
  }

  private broadcast(session: DoctorSession, event: DoctorServerEvent) {
    for (const listener of session.listeners) listener(event);
  }

  private removeProposalHistory(session: DoctorSession) {
    session.history = session.history.filter((event) => event.type !== "proposal");
  }

  private removeCodexHistory(session: DoctorSession) {
    session.history = session.history.filter((event) => event.type !== "output" && event.type !== "proposal");
  }
}

function codexCommand() {
  return process.platform === "win32" ? "codex.cmd" : "codex";
}

function doctorArgs(
  preferences: ForgePreferences,
  runtime: DoctorMcpRuntime,
  sessionId: string,
  token: string,
  prompt: string,
) {
  const mcpArgs = [
    ...runtime.args,
    "--mode",
    "doctor",
    "--server-url",
    runtime.serverUrl,
    "--session-id",
    sessionId,
    "--token",
    token,
  ];
  return [
    "-c",
    `model_reasoning_effort=${preferences.effort}`,
    "-m",
    preferences.model,
    "-c",
    `developer_instructions=${JSON.stringify(doctorInstructions)}`,
    "-c",
    `mcp_servers.scriptforge_doctor.command=${JSON.stringify(runtime.command)}`,
    "-c",
    `mcp_servers.scriptforge_doctor.args=${JSON.stringify(mcpArgs)}`,
    "-c",
    "mcp_servers.scriptforge_doctor.required=true",
    "-c",
    'mcp_servers.scriptforge_doctor.enabled_tools=["scriptforge_propose_install"]',
    prompt,
  ];
}

function doctorPrompt(
  toolId: string,
  missing: Array<{ name: string; version?: string; detectedVersion: string | null }>,
) {
  return `Diagnose the missing executable requirements for ScriptForge tool ${JSON.stringify(toolId)}: ${JSON.stringify(missing)}. Inspect this machine, then propose exact installation commands through scriptforge_propose_install. Do not install anything yourself.`;
}

function paste(pty: IPty, text: string) {
  pty.write(`\x1b[200~${text}\x1b[201~`);
  setTimeout(() => pty.write("\r"), 50).unref();
}

function displayCommand(command: string, args: string[]) {
  return [command, ...args]
    .map((part) => (/^[A-Za-z0-9_./:+,@=-]+$/.test(part) ? part : JSON.stringify(part)))
    .join(" ");
}
