import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { ToolArchiveService } from "../tools/archive";
import { defaultInstalledToolsRoot, listInstalledTools } from "../tools/installed";
import { listBundledTools } from "../tools/registry";
import { createToolArchiveRoutes } from "./archive/routes";
import { type CodexStatusChecker, CodexStatusService } from "./codex/status";
import { createToolConfigurationRoutes } from "./configuration/routes";
import { ToolConfigurationService } from "./configuration/service";
import { createDoctorApiRoutes, createDoctorWebSocketRoutes } from "./doctor/routes";
import { DoctorSessionService } from "./doctor/service";
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
  doctorSessions?: DoctorSessionService,
  archives = new ToolArchiveService(installedToolsRoot, new Set(listBundledTools().map((tool) => tool.id))),
  configuration = new ToolConfigurationService(),
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
        [
          ...bundled.map((manifest) => ({ manifest, origin: "bundled" as const })),
          ...installed.map((tool) => ({ manifest: tool.manifest, origin: "installed" as const })),
        ].map(async ({ manifest, origin }) => {
          const executableStatuses = await requirements.check(manifest.requiredExecutables);
          const configurationReady =
            manifest.configuration.length === 0 ||
            (await configuration
              .getStatus(manifest)
              .then((status) => status.ready)
              .catch(() => false));
          const { id, name, description, category, icon } = manifest;
          return {
            id,
            name,
            description,
            category,
            icon,
            status: !executableStatuses.every((item) => item.available)
              ? ("needs-install" as const)
              : configurationReady
                ? ("ready" as const)
                : ("needs-config" as const),
            origin,
            requirements: executableStatuses,
            configurationReady,
          };
        }),
      );
      return c.json({
        tools: [...readyTools, ...plannedTools.filter((tool) => !availableIds.has(tool.id))],
      });
    })
    .get("/codex/status", async (c) => c.json({ ok: true as const, ...(await codexStatus.check()) }))
    .route("/", createToolArchiveRoutes(archives, requirements, configuration))
    .route("/", createToolConfigurationRoutes(configuration, installedToolsRoot))
    .route("/doctor", doctorSessions ? createDoctorApiRoutes(doctorSessions) : new Hono())
    .route("/forge", createForgeApiRoutes(forgeSessions, jobService, installedToolsRoot, configuration))
    .route("/", createToolRuntimeApiRoutes(jobService));
}

const defaultCodexStatus = new CodexStatusService();
const defaultRequirements = new RequirementService();
const defaultDoctorSessions = new DoctorSessionService(defaultCodexStatus, defaultRequirements);
const defaultArchives = new ToolArchiveService(
  defaultInstalledToolsRoot(),
  new Set(listBundledTools().map((tool) => tool.id)),
);
const defaultConfiguration = new ToolConfigurationService();
export const apiRoutes = createApiRoutes(
  new ToolJobService(undefined, undefined, undefined, defaultRequirements, defaultConfiguration),
  new ForgeSessionService(defaultCodexStatus),
  defaultCodexStatus,
  undefined,
  defaultRequirements,
  defaultDoctorSessions,
  defaultArchives,
  defaultConfiguration,
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
    doctorSessions?: DoctorSessionService;
    archives?: ToolArchiveService;
    configuration?: ToolConfigurationService;
    configRoot?: string;
    encryptionKeyPath?: string;
  } = {},
) {
  const installedToolsRoot = options.installedToolsRoot ?? defaultInstalledToolsRoot();
  const requirements = options.requirements ?? new RequirementService();
  const configuration =
    options.configuration ?? new ToolConfigurationService(options.configRoot, options.encryptionKeyPath);
  const jobService = new ToolJobService(
    options.jobsRoot,
    options.toolsRoot,
    installedToolsRoot,
    requirements,
    configuration,
  );
  const codexStatus = options.codexStatus ?? new CodexStatusService();
  const forgeSessions = options.forgeSessions ?? new ForgeSessionService(codexStatus, options.stagingRoot);
  const doctorSessions =
    options.doctorSessions ??
    new DoctorSessionService(codexStatus, requirements, installedToolsRoot, options.toolsRoot);
  const archives =
    options.archives ?? new ToolArchiveService(installedToolsRoot, new Set(listBundledTools().map((tool) => tool.id)));
  const app = new Hono()
    .route(
      "/api",
      createApiRoutes(
        jobService,
        forgeSessions,
        codexStatus,
        installedToolsRoot,
        requirements,
        doctorSessions,
        archives,
        configuration,
      ),
    )
    .route("/", createJobWebSocketRoutes(jobService))
    .route("/", createForgeWebSocketRoutes(forgeSessions))
    .route("/", createDoctorWebSocketRoutes(doctorSessions));

  if (webRoot) {
    app.use("/*", serveStatic({ root: webRoot }));
    app.get("*", async (c) => {
      const html = await readFile(join(webRoot, "index.html"), "utf8");
      return c.html(html);
    });
  }

  return app;
}
