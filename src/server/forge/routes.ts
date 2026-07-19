import { upgradeWebSocket } from "@hono/node-server";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import { deleteInstalledTool, installTool } from "../../tools/installed";
import { findBundledTool } from "../../tools/registry";
import { configurationUpdateSchema } from "../configuration/routes";
import type { ToolConfigurationService } from "../configuration/service";
import type { ToolJobService } from "../jobs/service";
import type { ForgeSessionService } from "./service";
import {
  type ForgeServerEvent,
  forgeCandidateRequestSchema,
  forgeEfforts,
  forgeModels,
  forgePanelRequestSchema,
} from "./types";

const preferencesSchema = z.object({ model: z.enum(forgeModels), effort: z.enum(forgeEfforts) });
const clientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("input"), data: z.string().max(64_000) }),
  z.object({
    type: z.literal("resize"),
    cols: z.number().int().min(2).max(1_000),
    rows: z.number().int().min(1).max(500),
  }),
]);
const feedbackSchema = z.object({
  text: z.string().trim().min(1).max(64_000),
  dismiss: z.boolean().optional(),
  panelVersion: z.number().int().positive(),
});
const candidateRevisionSchema = z.object({ revision: z.string().regex(/^[a-f0-9]{64}$/) });

export function createForgeApiRoutes(
  service: ForgeSessionService,
  jobs: ToolJobService,
  installedToolsRoot?: string,
  configuration?: ToolConfigurationService,
) {
  return new Hono()
    .get("/sessions/active", (c) => c.json({ ok: true as const, ...service.getActiveSession() }))
    .get(
      "/sessions/:sessionId/candidate/configuration",
      validator("query", (value, c) => {
        const parsed = candidateRevisionSchema.safeParse(value);
        return parsed.success
          ? parsed.data
          : c.json({ ok: false as const, error: "The candidate revision is invalid." }, 400);
      }),
      async (c) => {
        try {
          const runtime = await service.getCandidateRuntime(c.req.param("sessionId"), c.req.valid("query").revision);
          if (!configuration) throw new Error("Candidate configuration is unavailable.");
          return c.json({
            ok: true as const,
            ...(await configuration.getStatus(runtime.manifest, candidateConfigurationScope(c.req.param("sessionId")))),
          });
        } catch (error) {
          return c.json(
            { ok: false as const, error: errorMessage(error, "Candidate configuration is unavailable.") },
            409,
          );
        }
      },
    )
    .put(
      "/sessions/:sessionId/candidate/configuration",
      validator("json", (value, c) => {
        const parsed = configurationUpdateSchema
          .extend({ revision: candidateRevisionSchema.shape.revision })
          .safeParse(value);
        return parsed.success
          ? parsed.data
          : c.json({ ok: false as const, error: "The candidate configuration is invalid." }, 400);
      }),
      async (c) => {
        try {
          if (!configuration) throw new Error("Candidate configuration is unavailable.");
          const update = c.req.valid("json");
          const runtime = await service.getCandidateRuntime(c.req.param("sessionId"), update.revision);
          return c.json({
            ok: true as const,
            ...(await configuration.save(
              runtime.manifest,
              update.values,
              update.clearSecrets,
              candidateConfigurationScope(c.req.param("sessionId")),
            )),
          });
        } catch (error) {
          return c.json(
            { ok: false as const, error: errorMessage(error, "Candidate configuration could not be saved.") },
            400,
          );
        }
      },
    )
    .post(
      "/sessions/:sessionId/candidate/jobs",
      validator("form", (value, c) => {
        const revision = typeof value.revision === "string" ? value.revision : "";
        const rawFiles = Array.isArray(value.files) ? value.files : [value.files];
        const files = rawFiles.filter((file): file is File => file instanceof File);
        if (!/^[a-f0-9]{64}$/.test(revision))
          return c.json({ ok: false as const, error: "The candidate revision is invalid." }, 400);
        try {
          const input = typeof value.input === "string" ? JSON.parse(value.input) : value.input;
          return { revision, input, files };
        } catch {
          return c.json({ ok: false as const, error: "The tool input is invalid." }, 400);
        }
      }),
      async (c) => {
        try {
          const request = c.req.valid("form");
          const runtime = await service.getCandidateRuntime(c.req.param("sessionId"), request.revision);
          const result = await jobs.startCandidate({
            toolId: runtime.manifest.id,
            input: request.input,
            files: request.files,
            directory: runtime.directory,
            manifest: runtime.manifest,
            configurationScope: candidateConfigurationScope(c.req.param("sessionId")),
          });
          service.trackCandidateJob(c.req.param("sessionId"), request.revision, result.jobId);
          return c.json({ ok: true as const, ...result }, 202);
        } catch (error) {
          return c.json(
            { ok: false as const, error: error instanceof Error ? error.message : "The candidate could not start." },
            409,
          );
        }
      },
    )
    .post(
      "/sessions/:sessionId/candidate/save",
      validator("json", (value, c) => {
        const parsed = candidateRevisionSchema.safeParse(value);
        return parsed.success
          ? parsed.data
          : c.json({ ok: false as const, error: "The candidate revision is invalid." }, 400);
      }),
      async (c) => {
        try {
          const sessionId = c.req.param("sessionId");
          const revision = c.req.valid("json").revision;
          const runtime = await service.getCandidateRuntime(sessionId, revision);
          if (findBundledTool(runtime.manifest.id)) throw new Error("A bundled tool already uses that name.");
          const jobId = service.getCandidateJob(sessionId, revision);
          if (!jobId || jobs.getSnapshot(jobId)?.status !== "succeeded") {
            throw new Error("Run this exact candidate successfully in Preview before saving it.");
          }
          const installed = await installTool(
            {
              manifest: runtime.manifest,
              manifestSource: runtime.candidate.manifestSource,
              scriptSource: runtime.candidate.scriptSource,
              interfaceHtml: runtime.candidate.interfaceHtml,
            },
            installedToolsRoot,
          );
          try {
            await configuration?.move(candidateConfigurationScope(sessionId), installed.manifest.id);
          } catch (error) {
            await deleteInstalledTool(installed.manifest.id, installedToolsRoot);
            throw error;
          }
          return c.json({ ok: true as const, tool: { id: installed.manifest.id, name: installed.manifest.name } }, 201);
        } catch (error) {
          return c.json(
            { ok: false as const, error: error instanceof Error ? error.message : "The candidate could not be saved." },
            409,
          );
        }
      },
    )
    .post(
      "/sessions/:sessionId/panel",
      validator("json", (value, c) => {
        const parsed = forgePanelRequestSchema.safeParse(value);
        return parsed.success ? parsed.data : c.json({ ok: false as const, error: "Invalid panel content." }, 400);
      }),
      (c) => {
        try {
          const panel = service.publishPanel(
            c.req.param("sessionId"),
            c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "",
            c.req.valid("json"),
          );
          return c.json({ ok: true as const, panel }, 201);
        } catch (error) {
          return c.json({ ok: false as const, error: error instanceof Error ? error.message : "Panel rejected." }, 403);
        }
      },
    )
    .post(
      "/sessions/:sessionId/candidate",
      validator("json", (value, c) => {
        const parsed = forgeCandidateRequestSchema.safeParse(value);
        return parsed.success ? parsed.data : c.json({ ok: false as const, error: "Invalid candidate summary." }, 400);
      }),
      async (c) => {
        try {
          const candidate = await service.publishCandidate(
            c.req.param("sessionId"),
            c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "",
            c.req.valid("json"),
          );
          return c.json({ ok: true as const, candidate }, 201);
        } catch (error) {
          return c.json(
            { ok: false as const, error: error instanceof Error ? error.message : "Candidate could not be read." },
            409,
          );
        }
      },
    )
    .post(
      "/sessions/:sessionId/feedback",
      validator("json", (value, c) => {
        const parsed = feedbackSchema.safeParse(value);
        return parsed.success ? parsed.data : c.json({ ok: false as const, error: "Feedback is required." }, 400);
      }),
      (c) => {
        try {
          const feedback = c.req.valid("json");
          service.sendFeedback(c.req.param("sessionId"), feedback.panelVersion, feedback.text, feedback.dismiss);
          return c.json({ ok: true as const });
        } catch (error) {
          return c.json(
            { ok: false as const, error: error instanceof Error ? error.message : "Feedback could not be sent." },
            409,
          );
        }
      },
    )
    .post(
      "/sessions",
      validator("json", (value, c) => {
        const parsed = preferencesSchema.safeParse(value);
        return parsed.success
          ? parsed.data
          : c.json({ ok: false as const, error: "Choose a valid model and effort." }, 400);
      }),
      async (c) => {
        try {
          return c.json({ ok: true as const, ...(await service.start(c.req.valid("json"))) }, 201);
        } catch (error) {
          return c.json(
            {
              ok: false as const,
              error: error instanceof Error ? error.message : "The Forge terminal could not start.",
            },
            400,
          );
        }
      },
    )
    .delete("/sessions/:sessionId", (c) => {
      const stopped = service.stop(c.req.param("sessionId"));
      return stopped
        ? c.json({ ok: true as const })
        : c.json({ ok: false as const, error: "That Forge terminal is no longer active." }, 404);
    });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function candidateConfigurationScope(sessionId: string) {
  if (!/^[a-f0-9-]+$/.test(sessionId)) throw new Error("Invalid Forge session identifier.");
  return `candidate-${sessionId}`;
}

export function createForgeWebSocketRoutes(service: ForgeSessionService) {
  return new Hono().get(
    "/ws/forge/:sessionId",
    upgradeWebSocket((c) => {
      const sessionId = c.req.param("sessionId") ?? "";
      let unsubscribe: (() => boolean) | undefined;
      const disconnect = () => {
        unsubscribe?.();
        unsubscribe = undefined;
      };
      return {
        onOpen(_event, socket) {
          const snapshot = service.getSnapshot(sessionId);
          if (!snapshot) {
            socket.send(
              JSON.stringify({
                type: "error",
                message: "That Forge session does not exist.",
              } satisfies ForgeServerEvent),
            );
            socket.close(1008, "Unknown Forge session");
            return;
          }
          unsubscribe = service.subscribe(sessionId, (event) => socket.send(JSON.stringify(event)));
          for (const event of snapshot.events) socket.send(JSON.stringify(event));
        },
        onMessage(event, socket) {
          try {
            const parsed = clientEventSchema.safeParse(JSON.parse(String(event.data)));
            if (!parsed.success) throw new Error("Invalid Forge terminal event.");
            if (parsed.data.type === "input") service.write(sessionId, parsed.data.data);
            else service.resize(sessionId, parsed.data.cols, parsed.data.rows);
          } catch (error) {
            socket.send(
              JSON.stringify({
                type: "error",
                message: error instanceof Error ? error.message : "Invalid Forge terminal event.",
              } satisfies ForgeServerEvent),
            );
          }
        },
        onClose() {
          disconnect();
        },
        onError() {
          disconnect();
        },
      };
    }),
  );
}
