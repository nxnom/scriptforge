import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { defaultInstalledToolsRoot, listInstalledTools } from "../tools/installed";
import { listBundledTools } from "../tools/registry";
import { type CodexStatusChecker, CodexStatusService } from "./codex/status";
import { createForgeApiRoutes, createForgeWebSocketRoutes } from "./forge/routes";
import { ForgeSessionService } from "./forge/service";
import { createJobWebSocketRoutes, createToolRuntimeApiRoutes } from "./jobs/routes";
import { ToolJobService } from "./jobs/service";
import { RequirementService } from "./requirements/service";

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

export function createApiRoutes(
  jobService: ToolJobService,
  forgeSessions: ForgeSessionService,
  codexStatus: CodexStatusChecker = new CodexStatusService(),
  installedToolsRoot = defaultInstalledToolsRoot(),
  requirements = new RequirementService(),
) {
  return new Hono()
    .get("/health", (c) =>
      c.json({
        ok: true as const,
        name: "ScriptForge",
        version: "0.1.0",
      }),
    )
    .get("/tools", async (c) => {
      const installed = await listInstalledTools(installedToolsRoot);
      const bundled = listBundledTools();
      const availableIds = new Set([...bundled.map((tool) => tool.id), ...installed.map((tool) => tool.manifest.id)]);
      const readyTools = await Promise.all(
        [...bundled, ...installed.map((tool) => tool.manifest)].map(async (manifest) => {
          const executableStatuses = await requirements.check(manifest.requiredExecutables);
          const { id, name, description, category, icon } = manifest;
          return {
            id,
            name,
            description,
            category,
            icon,
            status: executableStatuses.every((item) => item.available)
              ? ("ready" as const)
              : ("needs-install" as const),
            requirements: executableStatuses,
          };
        }),
      );
      return c.json({
        tools: [...readyTools, ...plannedTools.filter((tool) => !availableIds.has(tool.id))],
      });
    })
    .get("/codex/status", async (c) => c.json({ ok: true as const, ...(await codexStatus.check()) }))
    .route("/forge", createForgeApiRoutes(forgeSessions, jobService, installedToolsRoot))
    .route("/", createToolRuntimeApiRoutes(jobService));
}

const defaultCodexStatus = new CodexStatusService();
export const apiRoutes = createApiRoutes(
  new ToolJobService(),
  new ForgeSessionService(defaultCodexStatus),
  defaultCodexStatus,
);

export type ApiRoutes = typeof apiRoutes;

export function createApp(
  webRoot?: string,
  options: {
    jobsRoot?: string;
    toolsRoot?: string;
    stagingRoot?: string;
    codexStatus?: CodexStatusChecker;
    forgeSessions?: ForgeSessionService;
    installedToolsRoot?: string;
    requirements?: RequirementService;
  } = {},
) {
  const installedToolsRoot = options.installedToolsRoot ?? defaultInstalledToolsRoot();
  const requirements = options.requirements ?? new RequirementService();
  const jobService = new ToolJobService(options.jobsRoot, options.toolsRoot, installedToolsRoot, requirements);
  const codexStatus = options.codexStatus ?? new CodexStatusService();
  const forgeSessions = options.forgeSessions ?? new ForgeSessionService(codexStatus, options.stagingRoot);
  const app = new Hono()
    .route("/api", createApiRoutes(jobService, forgeSessions, codexStatus, installedToolsRoot, requirements))
    .route("/", createJobWebSocketRoutes(jobService))
    .route("/", createForgeWebSocketRoutes(forgeSessions));

  if (webRoot) {
    app.use("/*", serveStatic({ root: webRoot }));
    app.get("*", async (c) => {
      const html = await readFile(join(webRoot, "index.html"), "utf8");
      return c.html(html);
    });
  }

  return app;
}
