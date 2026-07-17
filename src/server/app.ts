import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

export const apiRoutes = new Hono()
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
        {
          id: "image-resizer",
          name: "Image Resizer",
          description: "Batch-resize photos to any size or ratio.",
          category: "Files",
          icon: "image" as const,
          status: "ready" as const,
        },
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
      ],
    }),
  );

export type ApiRoutes = typeof apiRoutes;

export function createApp(webRoot?: string) {
  const app = new Hono().route("/api", apiRoutes);

  if (webRoot) {
    app.use("/*", serveStatic({ root: webRoot }));
    app.get("*", async (c) => {
      const html = await readFile(join(webRoot, "index.html"), "utf8");
      return c.html(html);
    });
  }

  return app;
}
