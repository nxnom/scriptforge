import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { defaultInstalledToolsRoot, findInstalledTool } from "./installed";
import { type ToolManifest, toolManifestSchema } from "./manifest";

export const toolArchiveMimeType = "application/x-scriptforge-tool";
export const maximumArchiveBytes = 25 * 1024 * 1024;
const maximumExpandedBytes = 20 * 1024 * 1024;

const archivePathSchema = z.string().min(1).max(240).refine(isSafeArchivePath, "Archive contains an unsafe file path.");
const archiveSchema = z.object({
  format: z.literal("scriptforge-tool"),
  formatVersion: z.literal(1),
  files: z
    .array(
      z.object({
        path: archivePathSchema,
        encoding: z.literal("base64"),
        content: z.string(),
      }),
    )
    .min(3)
    .max(256),
});

export class ToolArchiveService {
  constructor(
    private readonly toolsRoot = defaultInstalledToolsRoot(),
    private readonly reservedIds = new Set<string>(),
  ) {}

  async export(toolId: string) {
    const tool = await findInstalledTool(toolId, this.toolsRoot);
    if (!tool) return;
    const files = await readDirectoryFiles(tool.directory);
    if (files.length > 256) throw new Error("That tool contains more than 256 files.");
    const expandedBytes = files.reduce((total, file) => total + Buffer.byteLength(file.content, "base64"), 0);
    if (expandedBytes > maximumExpandedBytes) throw new Error("That tool is larger than the 20 MB archive limit.");
    const data = Buffer.from(JSON.stringify({ format: "scriptforge-tool", formatVersion: 1, files }));
    if (data.byteLength > maximumArchiveBytes) throw new Error("The exported .forge file would be larger than 25 MB.");
    return {
      filename: `${tool.manifest.id}.forge`,
      data,
    };
  }

  async import(data: Uint8Array) {
    if (data.byteLength > maximumArchiveBytes) throw new Error("That .forge file is larger than 25 MB.");
    const parsed = parseArchive(data);
    const paths = new Set<string>();
    const decoded = parsed.files.map((file) => {
      if (paths.has(file.path)) throw new Error(`The archive contains duplicate path ${file.path}.`);
      paths.add(file.path);
      return { path: file.path, data: decodeBase64(file.content) };
    });
    const expandedBytes = decoded.reduce((total, file) => total + file.data.byteLength, 0);
    if (expandedBytes > maximumExpandedBytes) throw new Error("The expanded tool is larger than 20 MB.");

    const manifestFile = decoded.find((file) => file.path === "tool.json");
    if (!manifestFile) throw new Error("The archive is missing tool.json.");
    const manifest = parseManifest(manifestFile.data);
    validateRequiredFiles(manifest, paths);
    if (this.reservedIds.has(manifest.id)) throw new Error("A bundled tool already uses that identifier.");

    const destination = join(this.toolsRoot, manifest.id);
    if (await lstat(destination).catch(() => undefined)) throw new Error("A tool with that name is already installed.");
    await mkdir(this.toolsRoot, { recursive: true });
    const temporary = join(this.toolsRoot, `.import-${manifest.id}-${randomUUID()}`);
    await mkdir(temporary);
    try {
      for (const file of decoded) {
        const target = join(temporary, ...file.path.split("/"));
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, file.data, { flag: "wx" });
      }
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw error;
    }
    return { directory: destination, manifest: structuredClone(manifest) };
  }
}

async function readDirectoryFiles(directory: string, prefix = "") {
  const entries = await readdir(join(directory, ...prefix.split("/").filter(Boolean)), { withFileTypes: true });
  const files: Array<{ path: string; encoding: "base64"; content: string }> = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!isSafeArchivePath(path)) throw new Error("The tool contains an unsafe file path.");
    const source = join(directory, ...path.split("/"));
    const stats = await lstat(source);
    if (stats.isSymbolicLink()) throw new Error("Symbolic links cannot be exported in a .forge file.");
    if (stats.isDirectory()) files.push(...(await readDirectoryFiles(directory, path)));
    else if (stats.isFile())
      files.push({ path, encoding: "base64", content: (await readFile(source)).toString("base64") });
  }
  return files;
}

function validateRequiredFiles(manifest: ToolManifest, paths: Set<string>) {
  if (manifest.script !== "run.mjs" || manifest.interface.type !== "html" || manifest.interface.entry !== "ui.html") {
    throw new Error("The archive does not use the supported ScriptForge tool layout.");
  }
  for (const path of [manifest.script, manifest.interface.entry]) {
    if (!paths.has(path)) throw new Error(`The archive is missing ${path}.`);
  }
}

function isSafeArchivePath(path: string) {
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  const parts = path.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

function decodeBase64(content: string) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(content)) {
    throw new Error("The archive contains invalid file data.");
  }
  return Buffer.from(content, "base64");
}

function parseArchive(data: Uint8Array) {
  try {
    return archiveSchema.parse(JSON.parse(Buffer.from(data).toString("utf8")));
  } catch (error) {
    if (error instanceof z.ZodError) throw new Error(error.issues[0]?.message ?? "That .forge file is invalid.");
    throw new Error("That .forge file is not valid JSON.");
  }
}

function parseManifest(data: Buffer) {
  try {
    return toolManifestSchema.parse(JSON.parse(data.toString("utf8")));
  } catch (error) {
    if (error instanceof z.ZodError) throw new Error("The archive contains an invalid tool.json manifest.");
    throw new Error("The archive contains malformed tool.json JSON.");
  }
}
