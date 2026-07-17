import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveBundledToolDirectory(toolId: string, overrideRoot?: string) {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const roots = overrideRoot
    ? [overrideRoot]
    : [join(moduleDirectory, "tools"), join(process.cwd(), "src", "tools", "bundled")];
  const directory = roots
    .map((root) => join(root, toolId))
    .find((candidate) => existsSync(join(candidate, "tool.json")));

  if (!directory) throw new Error(`Bundled tool assets are missing for ${toolId}.`);
  return directory;
}
