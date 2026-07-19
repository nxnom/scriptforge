import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
let pdfAssets: Promise<{ library: string; worker: string }> | undefined;

export async function hydrateBundledToolUi(html: string) {
  if (!html.includes("/*__SCRIPT_FORGE_PDFJS__*/")) return html;
  const assets = await loadPdfAssets();
  return html
    .replace("/*__SCRIPT_FORGE_PDFJS__*/", () => assets.library)
    .replace("__SCRIPT_FORGE_PDF_WORKER_BASE64__", () => assets.worker);
}

function loadPdfAssets() {
  pdfAssets ??= (async () => {
    const root = dirname(require.resolve("pdfjs-dist/package.json"));
    const [library, worker] = await Promise.all([
      readFile(join(root, "legacy", "build", "pdf.min.mjs"), "utf8"),
      readFile(join(root, "legacy", "build", "pdf.worker.min.mjs")),
    ]);
    return { library, worker: worker.toString("base64") };
  })();
  return pdfAssets;
}
