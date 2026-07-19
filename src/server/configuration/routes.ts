import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import { findInstalledTool } from "../../tools/installed";
import { findBundledTool } from "../../tools/registry";
import type { ToolConfigurationService } from "./service";

export const configurationUpdateSchema = z.object({
  values: z.record(z.string(), z.unknown()).default({}),
  clearSecrets: z.array(z.string()).max(24).default([]),
});

export function createToolConfigurationRoutes(service: ToolConfigurationService, installedToolsRoot?: string) {
  return new Hono()
    .get("/tools/:toolId/configuration", async (c) => {
      try {
        const manifest = await findManifest(c.req.param("toolId"), installedToolsRoot);
        if (!manifest) return c.json({ ok: false as const, error: "That tool is not installed." }, 404);
        return c.json({ ok: true as const, ...(await service.getStatus(manifest)) });
      } catch (error) {
        return c.json({ ok: false as const, error: message(error) }, 400);
      }
    })
    .put(
      "/tools/:toolId/configuration",
      validator("json", (value, c) => {
        const parsed = configurationUpdateSchema.safeParse(value);
        return parsed.success
          ? parsed.data
          : c.json({ ok: false as const, error: "The tool configuration is invalid." }, 400);
      }),
      async (c) => {
        try {
          const manifest = await findManifest(c.req.param("toolId"), installedToolsRoot);
          if (!manifest) return c.json({ ok: false as const, error: "That tool is not installed." }, 404);
          const update = c.req.valid("json");
          return c.json({ ok: true as const, ...(await service.save(manifest, update.values, update.clearSecrets)) });
        } catch (error) {
          return c.json({ ok: false as const, error: message(error) }, 400);
        }
      },
    );
}

async function findManifest(toolId: string, installedToolsRoot?: string) {
  return findBundledTool(toolId) ?? (await findInstalledTool(toolId, installedToolsRoot))?.manifest;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "The tool configuration could not be saved.";
}
