import { upgradeWebSocket } from "@hono/node-server";
import { Hono } from "hono";
import { validator } from "hono/validator";
import type { ToolJobService } from "./service";
import type { ToolJobEvent } from "./types";

export function createToolRuntimeApiRoutes(service: ToolJobService) {
  return new Hono()
    .get("/tools/:toolId/requirements", async (c) => {
      const requirements = await service.getRequirements(c.req.param("toolId"));
      return requirements
        ? c.json({ ok: true as const, requirements, ready: requirements.every((item) => item.available) })
        : c.json({ ok: false as const, error: "That tool is not installed." }, 404);
    })
    .get("/tools/:toolId/ui", async (c) => {
      const html = await service.getToolUi(c.req.param("toolId"));
      if (!html) return c.json({ ok: false as const, error: "That tool interface is not available." }, 404);
      c.header(
        "Content-Security-Policy",
        "default-src 'none'; img-src 'self' blob: data:; media-src 'self' blob: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'",
      );
      c.header("Cache-Control", "no-store");
      return c.html(html);
    })
    .post(
      "/jobs",
      validator("form", (value, c) => {
        const toolId = typeof value.toolId === "string" ? value.toolId : "";
        const rawFiles = Array.isArray(value.files) ? value.files : [value.files];
        const files = rawFiles.filter((file): file is File => file instanceof File);
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(toolId))
          return c.json({ ok: false as const, error: "Choose a valid tool." }, 400);
        let input: unknown;
        try {
          input = typeof value.input === "string" ? JSON.parse(value.input) : value.input;
        } catch {
          return c.json({ ok: false as const, error: "The tool input is invalid." }, 400);
        }
        return { toolId, input, files };
      }),
      async (c) => {
        try {
          const result = await service.start(c.req.valid("form"));
          return c.json({ ok: true as const, ...result }, 202);
        } catch (error) {
          return c.json(
            { ok: false as const, error: error instanceof Error ? error.message : "The tool could not start." },
            400,
          );
        }
      },
    )
    .get("/jobs/:jobId/outputs/:outputId", async (c) => {
      const result = await service.readOutput(c.req.param("jobId"), c.req.param("outputId"));
      if (!result) return c.json({ ok: false as const, error: "That output is no longer available." }, 404);
      const disposition = c.req.query("download") === "1" ? "attachment" : "inline";
      c.header("Content-Type", result.output.mimeType);
      c.header("Content-Length", String(result.data.byteLength));
      c.header("Content-Disposition", `${disposition}; filename="${result.output.name}"`);
      c.header("Cache-Control", "no-store");
      return c.body(Uint8Array.from(result.data));
    });
}

export function createJobWebSocketRoutes(service: ToolJobService) {
  return new Hono().get(
    "/ws/jobs/:jobId",
    upgradeWebSocket((c) => {
      let unsubscribe: (() => boolean) | undefined;
      const jobId = c.req.param("jobId") ?? "";
      return {
        onOpen(_event, socket) {
          const snapshot = service.getSnapshot(jobId);
          if (!snapshot) {
            socket.send(JSON.stringify({ type: "failed", message: "That job does not exist." } satisfies ToolJobEvent));
            socket.close(1008, "Unknown job");
            return;
          }
          for (const event of snapshot.events) socket.send(JSON.stringify(event));
          unsubscribe = service.subscribe(jobId, (event) => socket.send(JSON.stringify(event)));
        },
        onClose() {
          unsubscribe?.();
        },
        onError() {
          unsubscribe?.();
        },
      };
    }),
  );
}
