import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { defaultInstalledToolsRoot, findInstalledTool } from "./installed";
import type { ToolManifest } from "./manifest";
import { findBundledTool } from "./registry";

const overrideStoreSchema = z.object({
  schemaVersion: z.literal(1),
  titles: z.record(z.string(), z.string().min(1).max(80)),
});
type OverrideStore = z.infer<typeof overrideStoreSchema>;

export const maximumToolNameLength = 80;

export function normalizeToolName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) throw new Error("Enter a tool title.");
  if (trimmed.length > maximumToolNameLength)
    throw new Error(`Keep the title under ${maximumToolNameLength} characters.`);
  return trimmed;
}

/**
 * Bundled manifests ship inside the installed package and stay read-only, so their titles live in a
 * small override file. Installed tools keep their title in their own tool.json, which travels with
 * exports and Forge updates.
 */
export class ToolTitleService {
  constructor(
    private readonly toolsRoot = defaultInstalledToolsRoot(),
    private readonly overridePath = join(homedir(), ".scriptforge", "tool-titles.json"),
  ) {}

  async overrides(): Promise<Record<string, string>> {
    return (await this.readStore()).titles;
  }

  async applyToBundled(manifests: ToolManifest[]): Promise<ToolManifest[]> {
    const titles = await this.overrides();
    return manifests.map((manifest) => {
      const title = titles[manifest.id];
      return title ? { ...manifest, name: title } : manifest;
    });
  }

  async rename(toolId: string, rawName: string) {
    const name = normalizeToolName(rawName);
    const installed = await findInstalledTool(toolId, this.toolsRoot);
    if (installed) {
      await this.writeInstalledName(installed.directory, name);
      return { id: toolId, name };
    }
    if (!findBundledTool(toolId)) return;
    const store = await this.readStore();
    store.titles[toolId] = name;
    await this.writeStore(store);
    return { id: toolId, name };
  }

  private async writeInstalledName(directory: string, name: string) {
    const manifestPath = join(directory, "tool.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.name = name;
    await writeFileAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  private async readStore(): Promise<OverrideStore> {
    const source = await readFile(this.overridePath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!source) return { schemaVersion: 1, titles: {} };
    const parsed = overrideStoreSchema.safeParse(JSON.parse(source));
    return parsed.success ? parsed.data : { schemaVersion: 1, titles: {} };
  }

  private async writeStore(store: OverrideStore) {
    await mkdir(dirname(this.overridePath), { recursive: true });
    await writeFileAtomic(this.overridePath, `${JSON.stringify(store, null, 2)}\n`);
  }
}

async function writeFileAtomic(destination: string, content: string) {
  const temporary = join(dirname(destination), `.${randomUUID()}.tmp`);
  await writeFile(temporary, content);
  try {
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
