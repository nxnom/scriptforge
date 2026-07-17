import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { listBundledTools } from "../tools/registry";
import { createImageResizerRoutes } from "./image-resizer-routes";

const plannedTools = [
  {
    id: "pdf-merge",
    name: "PDF Merge",
    description: "Combine multiple PDFs into one ordered document.",
    category: "Files",
    icon: "files" as const,
    status: "planned" as const,
  },
  {
    id: "csv-cleaner",
    name: "CSV Cleaner",
    description: "Fix headers, remove duplicates, and normalize values.",
    category: "Data",
    icon: "table" as const,
    status: "planned" as const,
  },
  {
    id: "invoice-renamer",
    name: "Invoice Renamer",
    description: "Rename invoices from their embedded metadata.",
    category: "Files",
    icon: "file-text" as const,
    status: "planned" as const,
  },
  {
    id: "screenshot-sorter",
    name: "Screenshot Sorter",
    description: "Organize screenshots into dated folders.",
    category: "Images",
    icon: "folder-tree" as const,
    status: "planned" as const,
  },
  {
    id: "audio-trimmer",
    name: "Audio Trimmer",
    description: "Trim silence from voice recordings.",
    category: "Audio",
    icon: "audio-waveform" as const,
    status: "planned" as const,
  },
  {
    id: "markdown-docx",
    name: "Markdown to Docx",
    description: "Turn Markdown notes into Word documents.",
    category: "Documents",
    icon: "file-type" as const,
    status: "planned" as const,
  },
  {
    id: "duplicate-finder",
    name: "Duplicate Finder",
    description: "Find duplicate files safely before cleanup.",
    category: "Files",
    icon: "scan-search" as const,
    status: "planned" as const,
  },
] as const;

export function createApiRoutes(jobsRoot?: string) {
  return new Hono()
    .get("/health", (c) =>
      c.json({
        ok: true as const,
        name: "ScriptForge",
        version: "0.1.0",
      }),
    )
    .get("/tools", (c) =>
      c.json({
        tools: [
          ...listBundledTools().map(({ id, name, description, category, icon }) => ({
            id,
            name,
            description,
            category,
            icon,
            status: "ready" as const,
          })),
          ...plannedTools,
        ],
      }),
    )
    .route("/tools/image-resizer", createImageResizerRoutes(jobsRoot));
}

export const apiRoutes = createApiRoutes();

export type ApiRoutes = typeof apiRoutes;

export function createApp(webRoot?: string, options: { jobsRoot?: string } = {}) {
  const app = new Hono().route("/api", createApiRoutes(options.jobsRoot));

  if (webRoot) {
    app.use("/*", serveStatic({ root: webRoot }));
    app.get("*", async (c) => {
      const html = await readFile(join(webRoot, "index.html"), "utf8");
      return c.html(html);
    });
  }

  return app;
}
