import { Hono } from "hono";
import { validator } from "hono/validator";
import type { ToolCloneService } from "../../tools/clone";
import { maximumToolNameLength, type ToolTitleService } from "../../tools/titles";
import type { ToolConfigurationService } from "../configuration/service";

export function createToolManagementRoutes(
  clones: ToolCloneService,
  titles: ToolTitleService,
  configuration?: ToolConfigurationService,
) {
  return new Hono()
    .patch("/tools/:toolId", nameValidator, async (c) => {
      try {
        const renamed = await titles.rename(c.req.param("toolId"), c.req.valid("json").name);
        if (!renamed) return c.json({ ok: false as const, error: "That tool does not exist." }, 404);
        return c.json({ ok: true as const, tool: renamed });
      } catch (error) {
        return c.json({ ok: false as const, error: errorMessage(error, "The title could not be saved.") }, 400);
      }
    })
    .post("/tools/:toolId/clone", nameValidator, async (c) => {
      const toolId = c.req.param("toolId");
      try {
        const clone = await clones.clone(toolId, c.req.valid("json").name);
        await configuration?.cloneValues(toolId, clone.manifest.id).catch(() => undefined);
        return c.json({ ok: true as const, tool: { id: clone.manifest.id, name: clone.manifest.name } }, 201);
      } catch (error) {
        return c.json({ ok: false as const, error: errorMessage(error, "The tool could not be cloned.") }, 400);
      }
    });
}

const nameValidator = validator("json", (value, c) => {
  const name = typeof value?.name === "string" ? value.name.trim().replace(/\s+/g, " ") : "";
  if (!name) return c.json({ ok: false as const, error: "Enter a tool title." }, 400);
  if (name.length > maximumToolNameLength)
    return c.json({ ok: false as const, error: `Keep the title under ${maximumToolNameLength} characters.` }, 400);
  return { name };
});

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
