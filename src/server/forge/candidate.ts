import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { toolManifestSchema } from "../../tools/manifest";
import type { ForgeCandidateDocument, ForgeCandidateRequest } from "./types";

export const maximumCandidateFileBytes = 3 * 1024 * 1024;

export async function readForgeCandidate(
  directory: string,
  request: ForgeCandidateRequest,
): Promise<ForgeCandidateDocument> {
  const manifestSource = await readCandidateFile(directory, "tool.json");
  const parsedJson = parseJson(manifestSource);
  const parsedManifest = toolManifestSchema.safeParse(parsedJson);
  if (!parsedManifest.success) {
    const issues = parsedManifest.error.issues
      .slice(0, 12)
      .map((issue) => `${issue.path.join(".") || "tool.json"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Candidate tool.json is invalid. Fix these exact fields: ${issues}`);
  }

  const manifest = parsedManifest.data;
  if (manifest.script !== "run.mjs") throw new Error("Candidate script must be run.mjs.");
  if (manifest.interface.type !== "html" || manifest.interface.entry !== "ui.html") {
    throw new Error("Candidate interface must be ui.html.");
  }

  const [scriptSource, interfaceHtml] = await Promise.all([
    readCandidateFile(directory, "run.mjs"),
    readCandidateFile(directory, "ui.html"),
  ]);
  const revision = createHash("sha256")
    .update(manifestSource)
    .update("\0")
    .update(scriptSource)
    .update("\0")
    .update(interfaceHtml)
    .digest("hex");

  return {
    ...request,
    name: manifest.name,
    description: manifest.description,
    requiredExecutables: manifest.requiredExecutables,
    manifestSource,
    scriptSource,
    interfaceHtml,
    revision,
    createdAt: Date.now(),
  };
}

async function readCandidateFile(directory: string, name: string) {
  const path = join(directory, name);
  const stats = await lstat(path).catch(() => undefined);
  if (!stats?.isFile() || stats.isSymbolicLink()) throw new Error(`Candidate ${name} is missing or unsafe.`);
  if (stats.size > maximumCandidateFileBytes) throw new Error(`Candidate ${name} exceeds the 3 MB review limit.`);
  return readFile(path, "utf8");
}

function parseJson(source: string) {
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new Error("Candidate tool.json is not valid JSON.");
  }
}
