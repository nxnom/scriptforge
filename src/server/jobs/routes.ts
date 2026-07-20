import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
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
      c.header("Cache-Control", "no-store");
      return c.html(html);
    })
    .get("/tools/:toolId/source", async (c) => {
      const source = await service.getToolSource(c.req.param("toolId"));
      if (!source) return c.json({ ok: false as const, error: "That tool source is not available." }, 404);
      c.header("Cache-Control", "no-store");
      return c.json({ ok: true as const, ...source });
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
      const result = await service.openOutput(c.req.param("jobId"), c.req.param("outputId"));
      if (!result) return c.json({ ok: false as const, error: "That output is no longer available." }, 404);
      const disposition = c.req.query("download") === "1" ? "attachment" : "inline";
      const range = parseByteRange(c.req.header("range"), result.size);
      if (range === null) {
        c.header("Content-Range", `bytes */${result.size}`);
        return c.body(null, 416);
      }
      const start = range?.start ?? 0;
      const end = range?.end ?? Math.max(0, result.size - 1);
      const length = result.size === 0 ? 0 : end - start + 1;
      c.header("Content-Type", result.output.mimeType);
      c.header("Content-Length", String(length));
      c.header("Accept-Ranges", "bytes");
      c.header("Content-Disposition", `${disposition}; filename="${safeFilename(result.output.name)}"`);
      c.header("Cache-Control", "no-store");
      if (range) {
        c.status(206);
        c.header("Content-Range", `bytes ${start}-${end}/${result.size}`);
      }
      if (result.size === 0) return c.body(new Uint8Array());
      const stream = createReadStream(result.path, { start, end });
      return c.body(Readable.toWeb(stream) as ReadableStream);
    });
}

function safeFilename(name: string) {
  return name.replace(/["\r\n\\]/g, "_");
}

function parseByteRange(header: string | undefined, size: number): { start: number; end: number } | undefined | null {
  if (!header) return;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size === 0) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;
  const start = rawStart ? Number(rawStart) : Math.max(0, size - Number(rawEnd));
  let end = rawEnd && rawStart ? Number(rawEnd) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start)
    return null;
  end = Math.min(end, size - 1);
  return { start, end };
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
