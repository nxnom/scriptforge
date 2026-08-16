import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveBundledToolDirectory } from "./directory";
import { defaultInstalledToolsRoot, findInstalledTool, listInstalledTools } from "./installed";
import type { ToolManifest } from "./manifest";
import { findBundledTool, listBundledTools } from "./registry";
import type { ToolTitleService } from "./titles";

const maximumFileBytes = 256 * 1024;

export type ToolReferenceSummary = {
  id: string;
  name: string;
  description: string;
  categories: string[];
  origin: "bundled" | "installed";
  requiredExecutables: string[];
  configurationKeys: string[];
};

export type ToolReferenceFile = { path: string; content: string; truncated: boolean };
export type ToolReferenceSource = {
  id: string;
  name: string;
  origin: "bundled" | "installed";
  files: ToolReferenceFile[];
};

/**
 * Read-only access to the source of any tool in the library, for a Forge session that wants an
 * existing tool as a reference. It never touches the configuration store: saved values live outside
 * these files, and the field definitions in tool.json are all a reader needs.
 */
export class ToolReferenceService {
  constructor(
    private readonly toolsRoot = defaultInstalledToolsRoot(),
    private readonly bundledRoot?: string,
    private readonly titles?: ToolTitleService,
  ) {}

  async list(): Promise<ToolReferenceSummary[]> {
    const bundled = (await this.titles?.applyToBundled(listBundledTools())) ?? listBundledTools();
    const installed = await listInstalledTools(this.toolsRoot);
    return [
      ...bundled.map((manifest) => summarize(manifest, "bundled")),
      ...installed.map((tool) => summarize(tool.manifest, "installed")),
    ];
  }

  async read(toolId: string): Promise<ToolReferenceSource | undefined> {
    const source = await this.resolve(toolId);
    if (!source) return;
    const { manifest, directory, origin } = source;
    const paths = [
      "tool.json",
      manifest.script,
      ...(manifest.interface.type === "html" ? [manifest.interface.entry] : []),
    ];
    const files = await Promise.all([...new Set(paths)].map((path) => readCapped(directory, path)));
    return { id: manifest.id, name: manifest.name, origin, files: files.filter((file) => file !== undefined) };
  }

  private async resolve(toolId: string) {
    const installed = await findInstalledTool(toolId, this.toolsRoot);
    if (installed) return { ...installed, origin: "installed" as const };
    const bundled = findBundledTool(toolId);
    if (!bundled) return;
    const named = (await this.titles?.applyToBundled([bundled]))?.[0] ?? bundled;
    return {
      manifest: named,
      directory: resolveBundledToolDirectory(toolId, this.bundledRoot),
      origin: "bundled" as const,
    };
  }
}

async function readCapped(directory: string, path: string): Promise<ToolReferenceFile | undefined> {
  const content = await readFile(join(directory, path), "utf8").catch(() => undefined);
  if (content === undefined) return;
  if (Buffer.byteLength(content, "utf8") <= maximumFileBytes) return { path, content, truncated: false };
  return {
    path,
    content: Buffer.from(content, "utf8").subarray(0, maximumFileBytes).toString("utf8"),
    truncated: true,
  };
}

function summarize(manifest: ToolManifest, origin: "bundled" | "installed"): ToolReferenceSummary {
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    categories: manifest.categories,
    origin,
    requiredExecutables: manifest.requiredExecutables.map((executable) => executable.name),
    configurationKeys: manifest.configuration.map((field) => field.key),
  };
}
