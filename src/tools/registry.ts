import appIconExporterManifest from "./bundled/app-icon-exporter/tool.json";
import codeScreenshotManifest from "./bundled/code-screenshot-studio/tool.json";
import imageResizerManifest from "./bundled/image-resizer/tool.json";
import pdfToolkitManifest from "./bundled/pdf-toolkit/tool.json";
import { type ToolManifest, toolManifestSchema } from "./manifest";

const bundledManifests = [
  toolManifestSchema.parse(imageResizerManifest),
  toolManifestSchema.parse(appIconExporterManifest),
  toolManifestSchema.parse(pdfToolkitManifest),
  toolManifestSchema.parse(codeScreenshotManifest),
] satisfies ToolManifest[];

export function listBundledTools(): ToolManifest[] {
  return bundledManifests.map((manifest) => structuredClone(manifest));
}

export function findBundledTool(id: string): ToolManifest | undefined {
  const manifest = bundledManifests.find((tool) => tool.id === id);
  return manifest ? structuredClone(manifest) : undefined;
}
