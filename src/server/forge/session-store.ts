import { randomUUID } from "node:crypto";
import { mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { z } from "zod";
import type { ForgeCandidateRequest } from "./types";

const sessionIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const persistedSessionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(sessionIdPattern),
  codexSessionId: z.string().optional(),
  status: z.enum(["running", "stopped", "interrupted"]),
  scope: z.enum(["create", "update"]),
  toolId: z.string().nullable(),
  toolName: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  candidateRequest: z
    .object({
      summary: z.string(),
      testSummary: z.string(),
      risks: z.array(z.string()).optional(),
    })
    .optional(),
});

export type PersistedForgeSession = z.infer<typeof persistedSessionSchema>;

export type ForgeDraft = {
  sessionId: string;
  name: string;
  status: "stopped" | "interrupted";
  scope: "create" | "update";
  toolId: string | null;
  updatedAt: number;
  resumable: boolean;
};

export class ForgeSessionStore {
  constructor(
    private readonly stagingRoot: string,
    private readonly metadataRoot = join(stagingRoot, ".sessions"),
    private readonly codexSessionsRoot = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "sessions"),
  ) {}

  async save(session: PersistedForgeSession) {
    await mkdir(this.metadataRoot, { recursive: true, mode: 0o700 });
    const destination = this.metadataPath(session.id);
    const temporary = join(this.metadataRoot, `.${session.id}-${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(session, null, 2), { mode: 0o600 });
    try {
      await rename(temporary, destination);
    } catch (error) {
      if (!new Set(["EEXIST", "EPERM"]).has((error as NodeJS.ErrnoException).code ?? "")) throw error;
      await rm(destination, { force: true });
      await rename(temporary, destination);
    }
  }

  async get(sessionId: string) {
    this.assertSessionId(sessionId);
    return (await this.readPersisted(sessionId)) ?? this.legacySession(sessionId);
  }

  private async readPersisted(sessionId: string) {
    const source = await readFile(this.metadataPath(sessionId), "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!source) return undefined;
    const parsed = persistedSessionSchema.safeParse(JSON.parse(source));
    if (!parsed.success) throw new Error("That saved Forge session is invalid.");
    return parsed.data;
  }

  async list(activeIds: Set<string>): Promise<ForgeDraft[]> {
    await mkdir(this.stagingRoot, { recursive: true });
    const entries = await readdir(this.stagingRoot, { withFileTypes: true });
    const codexSessions = await this.codexSessionsByDirectory();
    const sessions = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && sessionIdPattern.test(entry.name))
        .map(async (entry) => {
          const matchedCodexSessionId = codexSessions.get(join(this.stagingRoot, entry.name))?.id;
          const session =
            (await this.readPersisted(entry.name)) ?? (await this.legacySession(entry.name, matchedCodexSessionId));
          if (!session || activeIds.has(session.id)) return undefined;
          let changed = false;
          if (!session.codexSessionId && matchedCodexSessionId) {
            session.codexSessionId = matchedCodexSessionId;
            changed = true;
          }
          if (session.status === "running") {
            session.status = "interrupted";
            session.updatedAt = Date.now();
            changed = true;
          }
          if (changed) await this.save(session);
          const updatedAt = await this.candidateUpdatedAt(session.id, session.updatedAt);
          return {
            sessionId: session.id,
            name: (await this.candidateName(session.id)) ?? session.toolName ?? "Untitled tool",
            status: session.status,
            scope: session.scope,
            toolId: session.toolId,
            updatedAt,
            resumable: Boolean(session.codexSessionId),
          } satisfies ForgeDraft;
        }),
    );
    return sessions
      .filter((session): session is ForgeDraft => Boolean(session))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async resolveCodexSessionId(sessionId: string) {
    const session = await this.get(sessionId);
    if (!session) return undefined;
    if (session.codexSessionId) return session.codexSessionId;
    const match = (await this.codexSessionsByDirectory()).get(join(this.stagingRoot, sessionId));
    if (match) {
      session.codexSessionId = match.id;
      await this.save(session);
    }
    return match?.id;
  }

  async delete(sessionId: string) {
    this.assertSessionId(sessionId);
    await rm(join(this.stagingRoot, sessionId), { recursive: true, force: true });
    await rm(this.metadataPath(sessionId), { force: true });
  }

  private async legacySession(
    sessionId: string,
    knownCodexSessionId?: string,
  ): Promise<PersistedForgeSession | undefined> {
    const directory = join(this.stagingRoot, sessionId);
    const directoryStat = await stat(directory).catch(() => undefined);
    if (!directoryStat?.isDirectory()) return undefined;
    const codexSessionId = knownCodexSessionId ?? (await this.findCodexSessionForDirectory(directory));
    if (!codexSessionId) return undefined;
    const now = directoryStat.mtimeMs || Date.now();
    const session: PersistedForgeSession = {
      schemaVersion: 1,
      id: sessionId,
      codexSessionId,
      status: "interrupted",
      scope: "create",
      toolId: null,
      toolName: null,
      createdAt: directoryStat.birthtimeMs || now,
      updatedAt: now,
    };
    await this.save(session);
    return session;
  }

  private async findCodexSessionForDirectory(directory: string) {
    return (await this.codexSessionsByDirectory()).get(directory)?.id;
  }

  private async codexSessionsByDirectory() {
    const records = await this.sessionRecordPaths(this.codexSessionsRoot);
    const matches = new Map<string, { id: string; timestamp: number }>();
    for (const record of records) {
      const firstLine = await readFirstLine(record);
      if (!firstLine) continue;
      try {
        const parsed = JSON.parse(firstLine) as {
          payload?: { session_id?: string; id?: string; cwd?: string; timestamp?: string };
        };
        const payload = parsed.payload;
        const id = payload?.session_id ?? payload?.id;
        const directory = payload?.cwd;
        if (!directory || !id) continue;
        const timestamp = Date.parse(payload.timestamp ?? "") || 0;
        const current = matches.get(directory);
        if (!current || timestamp > current.timestamp) matches.set(directory, { id, timestamp });
      } catch {
        // Ignore unrelated or partially written Codex records.
      }
    }
    return matches;
  }

  private async sessionRecordPaths(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return this.sessionRecordPaths(path);
        return entry.isFile() && entry.name.endsWith(".jsonl") ? [path] : [];
      }),
    );
    return nested.flat();
  }

  private async candidateName(sessionId: string) {
    try {
      const manifest = JSON.parse(await readFile(join(this.stagingRoot, sessionId, "tool.json"), "utf8")) as {
        name?: unknown;
      };
      return typeof manifest.name === "string" && manifest.name.trim() ? manifest.name.trim() : undefined;
    } catch {
      return undefined;
    }
  }

  private async candidateUpdatedAt(sessionId: string, fallback: number) {
    const times = await Promise.all(
      ["tool.json", "run.mjs", "ui.html"].map((file) =>
        stat(join(this.stagingRoot, sessionId, file))
          .then((value) => value.mtimeMs)
          .catch(() => 0),
      ),
    );
    return Math.max(fallback, ...times);
  }

  private metadataPath(sessionId: string) {
    return join(this.metadataRoot, `${sessionId}.json`);
  }

  private assertSessionId(sessionId: string) {
    if (!sessionIdPattern.test(sessionId) || basename(sessionId) !== sessionId) {
      throw new Error("Invalid Forge session identifier.");
    }
  }
}

async function readFirstLine(path: string) {
  const handle = await open(path, "r").catch(() => undefined);
  if (!handle) return "";
  try {
    const chunks: Buffer[] = [];
    let position = 0;
    while (position < 2 * 1024 * 1024) {
      const buffer = Buffer.alloc(64 * 1024);
      const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, position);
      if (!bytesRead) break;
      const chunk = buffer.subarray(0, bytesRead);
      const newline = chunk.indexOf(10);
      chunks.push(newline === -1 ? chunk : chunk.subarray(0, newline));
      position += bytesRead;
      if (newline !== -1) break;
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    await handle.close();
  }
}

export function createPersistedSession(
  id: string,
  scope: "create" | "update",
  toolId?: string,
  toolName?: string,
): PersistedForgeSession {
  const now = Date.now();
  return {
    schemaVersion: 1,
    id,
    status: "running",
    scope,
    toolId: toolId ?? null,
    toolName: toolName ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function withCandidateRequest(session: PersistedForgeSession, request: ForgeCandidateRequest) {
  return { ...session, candidateRequest: request, updatedAt: Date.now() } satisfies PersistedForgeSession;
}
