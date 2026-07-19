import { Hono } from "hono";
import { validator } from "hono/validator";
import type { ToolArchiveService } from "../../tools/archive";
import { maximumArchiveBytes, toolArchiveMimeType } from "../../tools/archive";
import type { RequirementService } from "../requirements/service";

export function createToolArchiveRoutes(service: ToolArchiveService, requirements: RequirementService) {
  return new Hono()
    .delete("/tools/:toolId", async (c) => {
      try {
        const result = await service.delete(c.req.param("toolId"));
        if (result === "bundled") return c.json({ ok: false as const, error: "Bundled tools cannot be deleted." }, 403);
        if (result === "not-found")
          return c.json({ ok: false as const, error: "That installed tool does not exist." }, 404);
        return c.json({ ok: true as const });
      } catch (error) {
        return c.json({ ok: false as const, error: errorMessage(error, "The tool could not be deleted.") }, 400);
      }
    })
    .get("/tools/:toolId/export", async (c) => {
      try {
        const archive = await service.export(c.req.param("toolId"));
        if (!archive) return c.json({ ok: false as const, error: "Only installed tools can be exported." }, 404);
        c.header("Content-Type", toolArchiveMimeType);
        c.header("Content-Disposition", `attachment; filename="${archive.filename}"`);
        c.header("Content-Length", String(archive.data.byteLength));
        c.header("Cache-Control", "no-store");
        return c.body(Uint8Array.from(archive.data));
      } catch (error) {
        return c.json({ ok: false as const, error: errorMessage(error, "The tool could not be exported.") }, 400);
      }
    })
    .post(
      "/tools/import",
      validator("form", (value, c) => {
        const file = value.file;
        if (!(file instanceof File)) return c.json({ ok: false as const, error: "Choose a .forge file." }, 400);
        if (!file.name.toLowerCase().endsWith(".forge"))
          return c.json({ ok: false as const, error: "ScriptForge imports .forge files only." }, 400);
        if (file.size > maximumArchiveBytes)
          return c.json({ ok: false as const, error: "That .forge file is larger than 25 MB." }, 413);
        return { file };
      }),
      async (c) => {
        try {
          const installed = await service.import(new Uint8Array(await c.req.valid("form").file.arrayBuffer()));
          const executableStatuses = await requirements.check(installed.manifest.requiredExecutables);
          return c.json(
            {
              ok: true as const,
              tool: {
                id: installed.manifest.id,
                name: installed.manifest.name,
                status: executableStatuses.every((item) => item.available)
                  ? ("ready" as const)
                  : ("needs-install" as const),
                requirements: executableStatuses,
              },
            },
            201,
          );
        } catch (error) {
          return c.json({ ok: false as const, error: errorMessage(error, "That .forge file is invalid.") }, 400);
        }
      },
    );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
