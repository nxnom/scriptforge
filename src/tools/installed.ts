import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type ToolManifest, toolManifestSchema } from "./manifest";

export type InstalledTool = { directory: string; manifest: ToolManifest };
export type InstallableToolFiles = {
  manifest: ToolManifest;
  manifestSource: string;
  scriptSource: string;
  interfaceHtml: string;
};

export function defaultInstalledToolsRoot() {
  return join(homedir(), ".scriptforge", "tools");
}

export async function listInstalledTools(root = defaultInstalledToolsRoot()): Promise<InstalledTool[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const tools = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && isToolId(entry.name))
      .map(async (entry) => {
        const tool = await readInstalledTool(join(root, entry.name));
        return tool?.manifest.id === entry.name ? tool : undefined;
      }),
  );
  return tools.filter((tool): tool is InstalledTool => tool !== undefined);
}

export async function findInstalledTool(id: string, root = defaultInstalledToolsRoot()) {
  if (!isToolId(id)) return;
  const tool = await readInstalledTool(join(root, id));
  return tool?.manifest.id === id ? tool : undefined;
}

export async function deleteInstalledTool(id: string, root = defaultInstalledToolsRoot()) {
  const tool = await findInstalledTool(id, root);
  if (!tool) return false;
  const removed = join(root, `.delete-${id}-${randomUUID()}`);
  await rename(tool.directory, removed);
  await rm(removed, { recursive: true, force: true }).catch(() => undefined);
  return true;
}

export async function installTool(files: InstallableToolFiles, root = defaultInstalledToolsRoot()) {
  await mkdir(root, { recursive: true });
  const destination = join(root, files.manifest.id);
  if (await lstat(destination).catch(() => undefined)) throw new Error("A tool with that name is already installed.");

  const temporary = join(root, `.install-${files.manifest.id}-${randomUUID()}`);
  await mkdir(temporary);
  try {
    await Promise.all([
      writeFile(join(temporary, "tool.json"), files.manifestSource, { flag: "wx" }),
      writeFile(join(temporary, "run.mjs"), files.scriptSource, { flag: "wx" }),
      writeFile(join(temporary, "ui.html"), files.interfaceHtml, { flag: "wx" }),
    ]);
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
  return { directory: destination, manifest: structuredClone(files.manifest) };
}

async function readInstalledTool(directory: string): Promise<InstalledTool | undefined> {
  try {
    const manifestPath = join(directory, "tool.json");
    const stats = await lstat(manifestPath);
    if (!stats.isFile() || stats.isSymbolicLink()) return;
    const manifest = toolManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
    if (manifest.script !== "run.mjs" || manifest.interface.type !== "html" || manifest.interface.entry !== "ui.html")
      return;
    const assets = await Promise.all([lstat(join(directory, "run.mjs")), lstat(join(directory, "ui.html"))]);
    if (assets.some((asset) => !asset.isFile() || asset.isSymbolicLink())) return;
    return { directory, manifest };
  } catch {
    return;
  }
}

function isToolId(id: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
}
