import { randomUUID } from "node:crypto";
import { cp, lstat, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveBundledToolDirectory } from "./directory";
import { defaultInstalledToolsRoot, findInstalledTool, type InstalledTool } from "./installed";
import { toolManifestSchema } from "./manifest";
import { findBundledTool, listBundledTools } from "./registry";
import { normalizeToolName } from "./titles";

const maximumCloneBytes = 50 * 1024 * 1024;

export type ToolCloneResult = InstalledTool & { source: { id: string; origin: "bundled" | "installed" } };

/**
 * A clone is always a normal user tool in the installed root, even when the source is bundled. The
 * source directory is copied byte for byte and only tool.json is rewritten with the new id and title.
 */
export class ToolCloneService {
  constructor(
    private readonly toolsRoot = defaultInstalledToolsRoot(),
    private readonly bundledRoot?: string,
    private readonly reservedIds = new Set(listBundledTools().map((tool) => tool.id)),
  ) {}

  async clone(toolId: string, rawName: string): Promise<ToolCloneResult> {
    const name = normalizeToolName(rawName);
    const source = await this.resolveSource(toolId);
    if (!source) throw new Error("That tool is not available to clone.");

    const id = await this.availableId(name, toolId);
    const manifest = toolManifestSchema.parse({ ...source.manifest, id, name });
    await mkdir(this.toolsRoot, { recursive: true });
    const destination = join(this.toolsRoot, id);
    const temporary = join(this.toolsRoot, `.clone-${id}-${randomUUID()}`);
    try {
      await cp(source.directory, temporary, { recursive: true, dereference: true, errorOnExist: true, force: false });
      await assertCloneSize(temporary);
      await writeFile(join(temporary, "tool.json"), `${JSON.stringify(manifest, null, 2)}\n`);
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw error;
    }
    return { directory: destination, manifest, source: { id: toolId, origin: source.origin } };
  }

  private async resolveSource(toolId: string) {
    const installed = await findInstalledTool(toolId, this.toolsRoot);
    if (installed) return { ...installed, origin: "installed" as const };
    const bundled = findBundledTool(toolId);
    if (!bundled) return;
    return {
      directory: resolveBundledToolDirectory(toolId, this.bundledRoot),
      manifest: bundled,
      origin: "bundled" as const,
    };
  }

  private async availableId(name: string, sourceId: string) {
    const base = toToolId(name) || toToolId(`${sourceId} copy`) || "cloned-tool";
    for (let attempt = 1; attempt <= 100; attempt += 1) {
      const id = attempt === 1 ? base : `${base}-${attempt}`;
      if (this.reservedIds.has(id)) continue;
      if (!(await lstat(join(this.toolsRoot, id)).catch(() => undefined))) return id;
    }
    throw new Error("Too many tools already use that title. Choose another one.");
  }
}

export function toToolId(name: string) {
  return name
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

async function assertCloneSize(directory: string) {
  if ((await directorySize(directory)) > maximumCloneBytes) throw new Error("That tool is too large to clone.");
}

async function directorySize(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) total += await directorySize(path);
    else if (entry.isFile()) total += (await lstat(path)).size;
  }
  return total;
}
