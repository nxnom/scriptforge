import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { z } from "zod";
import { resolveBundledToolDirectory } from "../../tools/directory";
import { defaultInstalledToolsRoot, findInstalledTool } from "../../tools/installed";
import type { ToolManifest } from "../../tools/manifest";
import { findBundledTool } from "../../tools/registry";
import { ToolConfigurationService } from "../configuration/service";
import { RequirementService } from "../requirements/service";
import { hydrateBundledToolUi } from "./bundled-ui-assets";
import type { ToolJobEvent, ToolJobSnapshot, ToolOutput } from "./types";

const scriptEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("log"), level: z.enum(["info", "success", "warning", "error"]), message: z.string() }),
  z.object({ type: z.literal("progress"), value: z.number().min(0).max(1), label: z.string().optional() }),
  z
    .object({
      type: z.literal("result"),
      outputs: z
        .array(
          z.object({
            path: z.string().min(1),
            name: z.string().min(1),
            mimeType: z.string().min(1),
            metadata: z.unknown().optional(),
          }),
        )
        .optional(),
      data: z.unknown().optional(),
    })
    .refine((event) => event.data !== undefined || event.outputs !== undefined),
  z.object({ type: z.literal("failed"), message: z.string().min(1) }),
]);

interface StoredOutput extends ToolOutput {
  path: string;
}
interface JobRecord extends ToolJobSnapshot {
  directory: string;
  toolDirectory: string;
  script: string;
  receivedResult: boolean;
  outputs: Map<string, StoredOutput>;
  listeners: Set<(event: ToolJobEvent) => void>;
  secrets: string[];
}

export interface StartJobInput {
  toolId: string;
  input: unknown;
  files: File[];
}

export interface StartCandidateJobInput extends StartJobInput {
  directory: string;
  manifest: ToolManifest;
  configurationScope?: string;
}

export class ToolJobService {
  private readonly jobs = new Map<string, JobRecord>();

  constructor(
    private readonly jobsRoot = join(homedir(), ".scriptforge", "jobs"),
    private readonly toolsRoot?: string,
    private readonly installedToolsRoot = defaultInstalledToolsRoot(),
    private readonly requirements = new RequirementService(),
    private readonly configuration = new ToolConfigurationService(),
  ) {}

  async start({ toolId, input, files }: StartJobInput) {
    const manifest = findBundledTool(toolId);
    if (manifest) {
      await this.requirements.assertAvailable(manifest.requiredExecutables);
      const resolved = await this.configuration.resolve(manifest);
      return this.startResolved(
        { toolId, input, files },
        resolveBundledToolDirectory(toolId, this.toolsRoot),
        manifest.script,
        resolved,
      );
    }
    const installed = await findInstalledTool(toolId, this.installedToolsRoot);
    if (!installed) throw new Error("That tool is not installed.");
    await this.requirements.assertAvailable(installed.manifest.requiredExecutables);
    const resolved = await this.configuration.resolve(installed.manifest);
    return this.startResolved({ toolId, input, files }, installed.directory, installed.manifest.script, resolved);
  }

  async startCandidate({ toolId, input, files, directory, manifest, configurationScope }: StartCandidateJobInput) {
    const resolved = await this.configuration.resolve(manifest, configurationScope);
    return this.startResolved({ toolId, input, files }, directory, manifest.script, resolved);
  }

  private async startResolved(
    { toolId, input, files }: StartJobInput,
    toolDirectory: string,
    script: string,
    resolved: { config: Record<string, unknown>; secrets: string[] },
  ) {
    if (files.some((file) => file.size > 25 * 1024 * 1024))
      throw new Error("Each input file must be 25 MB or smaller.");
    if (files.reduce((total, file) => total + file.size, 0) > 250 * 1024 * 1024)
      throw new Error("Choose files totaling 250 MB or less.");

    const id = randomUUID();
    const directory = join(this.jobsRoot, id);
    const inputDirectory = join(directory, "inputs");
    const outputDirectory = join(directory, "outputs");
    await mkdir(inputDirectory, { recursive: true });
    await mkdir(outputDirectory, { recursive: true });

    const storedFiles = [];
    for (const [index, file] of files.entries()) {
      const filename = `${index + 1}-${safeName(file.name)}`;
      const path = join(inputDirectory, filename);
      await writeFile(path, Buffer.from(await file.arrayBuffer()));
      storedFiles.push({ path, name: file.name, type: file.type, size: file.size });
    }

    const job: JobRecord = {
      id,
      toolId,
      status: "queued",
      directory,
      toolDirectory,
      script,
      receivedResult: false,
      events: [],
      outputs: new Map(),
      listeners: new Set(),
      secrets: resolved.secrets,
    };
    this.jobs.set(id, job);
    this.emit(job, { type: "status", status: "queued" });
    void this.execute(job, {
      jobId: id,
      input,
      files: storedFiles,
      outputDir: outputDirectory,
      config: resolved.config,
    });
    return { jobId: id };
  }

  getSnapshot(jobId: string): ToolJobSnapshot | undefined {
    const job = this.jobs.get(jobId);
    return job ? { id: job.id, toolId: job.toolId, status: job.status, events: [...job.events] } : undefined;
  }

  subscribe(jobId: string, listener: (event: ToolJobEvent) => void) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.listeners.add(listener);
    return () => job.listeners.delete(listener);
  }

  async readOutput(jobId: string, outputId: string) {
    const output = this.jobs.get(jobId)?.outputs.get(outputId);
    if (!output) return;
    return { output, data: await readFile(output.path) };
  }

  async getToolUi(toolId: string) {
    const manifest = findBundledTool(toolId);
    if (manifest?.interface.type === "html") {
      const directory = resolveBundledToolDirectory(toolId, this.toolsRoot);
      return hydrateBundledToolUi(await readFile(join(directory, manifest.interface.entry), "utf8"));
    }
    const installed = await findInstalledTool(toolId, this.installedToolsRoot);
    if (installed?.manifest.interface.type !== "html") return;
    return readFile(join(installed.directory, installed.manifest.interface.entry), "utf8");
  }

  async getToolSource(toolId: string) {
    const bundled = findBundledTool(toolId);
    if (bundled) {
      const directory = resolveBundledToolDirectory(toolId, this.toolsRoot);
      const [scriptSource, manifestSource] = await Promise.all([
        readFile(join(directory, bundled.script), "utf8"),
        readFile(join(directory, "tool.json"), "utf8"),
      ]);
      return { scriptSource, manifestSource };
    }
    const installed = await findInstalledTool(toolId, this.installedToolsRoot);
    if (!installed) return;
    const [scriptSource, manifestSource] = await Promise.all([
      readFile(join(installed.directory, installed.manifest.script), "utf8"),
      readFile(join(installed.directory, "tool.json"), "utf8"),
    ]);
    return { scriptSource, manifestSource };
  }

  async getRequirements(toolId: string) {
    const bundled = findBundledTool(toolId);
    const manifest = bundled ?? (await findInstalledTool(toolId, this.installedToolsRoot))?.manifest;
    if (!manifest) return;
    return this.requirements.check(manifest.requiredExecutables);
  }

  private async execute(job: JobRecord, request: unknown) {
    const scriptPath = resolve(job.toolDirectory, job.script);
    if (!scriptPath.startsWith(`${resolve(job.toolDirectory)}${sep}`))
      return this.fail(job, "The tool script path is invalid.");

    this.emit(job, { type: "status", status: "running" });
    const child = spawn(process.execPath, [scriptPath], {
      cwd: job.toolDirectory,
      env: { ...process.env, SCRIPT_FORGE_JOB_ID: job.id },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let eventQueue = Promise.resolve();

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) eventQueue = eventQueue.then(() => this.handleScriptEvent(job, line));
    });
    child.stderr.on("data", (chunk: Buffer) =>
      this.emit(job, { type: "log", level: "warning", message: this.redact(job, chunk.toString("utf8").trim()) }),
    );
    child.on("error", (error) => this.fail(job, this.redact(job, error.message)));
    child.on("close", async (code) => {
      if (stdout.trim()) await this.handleScriptEvent(job, stdout);
      await eventQueue;
      if (job.status === "failed") return;
      if (code === 0 && job.receivedResult) {
        this.emit(job, { type: "status", status: "succeeded" });
        this.emit(job, { type: "complete" });
      } else this.fail(job, "The tool stopped before producing a result.");
    });
    child.stdin.end(JSON.stringify(request));
  }

  private async handleScriptEvent(job: JobRecord, line: string) {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      return this.emit(job, { type: "log", level: "warning", message: this.redact(job, line) });
    }
    const parsed = scriptEventSchema.safeParse(raw);
    if (!parsed.success) return this.fail(job, "The tool emitted an invalid event.");
    if (parsed.data.type === "failed") return this.fail(job, parsed.data.message);
    if (parsed.data.type !== "result") return this.emit(job, parsed.data);

    const outputs: ToolOutput[] = [];
    for (const candidate of parsed.data.outputs ?? []) {
      const path = resolve(job.directory, "outputs", candidate.path);
      if (!path.startsWith(`${resolve(job.directory, "outputs")}${sep}`))
        return this.fail(job, "The tool returned an unsafe output path.");
      await stat(path);
      const id = randomUUID();
      const baseUrl = `/api/jobs/${job.id}/outputs/${id}`;
      const output = {
        id,
        name: safeName(candidate.name),
        mimeType: candidate.mimeType,
        metadata: candidate.metadata,
        previewUrl: baseUrl,
        downloadUrl: `${baseUrl}?download=1`,
      };
      job.outputs.set(id, { ...output, path });
      outputs.push(output);
    }
    job.receivedResult = true;
    this.emit(job, { type: "result", outputs, data: parsed.data.data });
  }

  private fail(job: JobRecord, message: string) {
    if (job.status === "failed") return;
    this.emit(job, { type: "status", status: "failed" });
    this.emit(job, { type: "failed", message: this.redact(job, message) });
  }

  private redact(job: JobRecord, value: string) {
    return job.secrets.reduce(
      (redacted, secret) => (secret ? redacted.split(secret).join("[REDACTED]") : redacted),
      value,
    );
  }

  private emit(job: JobRecord, event: ToolJobEvent) {
    const safeEvent = redactUnknown(event, job.secrets) as ToolJobEvent;
    if (safeEvent.type === "status") job.status = safeEvent.status;
    job.events.push(safeEvent);
    for (const listener of job.listeners) listener(safeEvent);
  }
}

function safeName(name: string) {
  return basename(name).replace(/[^a-zA-Z0-9._-]+/g, "-") || "file";
}

function redactUnknown(value: unknown, secrets: string[]): unknown {
  if (typeof value === "string") {
    return secrets.reduce((redacted, secret) => (secret ? redacted.split(secret).join("[REDACTED]") : redacted), value);
  }
  if (Array.isArray(value)) return value.map((item) => redactUnknown(item, secrets));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactUnknown(item, secrets)]));
  }
  return value;
}
