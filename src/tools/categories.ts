import { listInstalledTools } from "./installed";
import { listBundledTools } from "./registry";

export async function listToolCategories(installedToolsRoot?: string) {
  const installed = await listInstalledTools(installedToolsRoot);
  const categories = [...listBundledTools(), ...installed.map((tool) => tool.manifest)].flatMap(
    (manifest) => manifest.categories,
  );
  return [...new Map(categories.map((category) => [category.toLocaleLowerCase(), category])).values()].sort((a, b) =>
    a.localeCompare(b),
  );
}
