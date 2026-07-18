import { upgradeWebSocket } from "@hono/node-server";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import { forgeEfforts, forgeModels } from "../forge/types";
import type { DoctorSessionService } from "./service";
import { type DoctorServerEvent, doctorProposalSchema } from "./types";

const startSchema = z.object({
  toolId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  model: z.enum(forgeModels),
  effort: z.enum(forgeEfforts),
});
const rejectSchema = z.object({ feedback: z.string().max(8_000).default("") });
const clientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("input"), data: z.string().max(64_000) }),
  z.object({
    type: z.literal("resize"),
    cols: z.number().int().min(2).max(1_000),
    rows: z.number().int().min(1).max(500),
  }),
]);

export function createDoctorApiRoutes(service: DoctorSessionService) {
  return new Hono()
    .get("/sessions/active", (c) => c.json({ ok: true as const, ...service.getActiveSession() }))
    .post(
      "/sessions",
      validator("json", (value, c) => {
        const parsed = startSchema.safeParse(value);
        return parsed.success ? parsed.data : c.json({ ok: false as const, error: "Invalid Doctor request." }, 400);
      }),
      async (c) => {
        try {
          const { toolId, model, effort } = c.req.valid("json");
          return c.json({ ok: true as const, ...(await service.start(toolId, { model, effort })) }, 201);
        } catch (error) {
          return c.json({ ok: false as const, error: errorMessage(error, "Doctor could not start.") }, 409);
        }
      },
    )
    .post(
      "/sessions/:sessionId/proposal",
      validator("json", (value, c) => {
        const parsed = doctorProposalSchema.safeParse(value);
        return parsed.success ? parsed.data : c.json({ ok: false as const, error: "Invalid install proposal." }, 400);
      }),
      (c) => {
        try {
          const proposal = service.propose(
            c.req.param("sessionId"),
            c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "",
            c.req.valid("json"),
          );
          return c.json({ ok: true as const, proposal }, 201);
        } catch (error) {
          return c.json({ ok: false as const, error: errorMessage(error, "Install proposal rejected.") }, 403);
        }
      },
    )
    .post("/sessions/:sessionId/proposal/approve", (c) => {
      try {
        service.approve(c.req.param("sessionId"));
        return c.json({ ok: true as const }, 202);
      } catch (error) {
        return c.json({ ok: false as const, error: errorMessage(error, "Installation could not start.") }, 409);
      }
    })
    .post(
      "/sessions/:sessionId/proposal/reject",
      validator("json", (value, c) => {
        const parsed = rejectSchema.safeParse(value);
        return parsed.success ? parsed.data : c.json({ ok: false as const, error: "Invalid feedback." }, 400);
      }),
      (c) => {
        try {
          service.reject(c.req.param("sessionId"), c.req.valid("json").feedback);
          return c.json({ ok: true as const });
        } catch (error) {
          return c.json({ ok: false as const, error: errorMessage(error, "Proposal could not be rejected.") }, 409);
        }
      },
    )
    .delete("/sessions/:sessionId", (c) =>
      service.stop(c.req.param("sessionId"))
        ? c.json({ ok: true as const })
        : c.json({ ok: false as const, error: "That Doctor session is no longer active." }, 404),
    );
}

export function createDoctorWebSocketRoutes(service: DoctorSessionService) {
  return new Hono().get(
    "/ws/doctor/:sessionId",
    upgradeWebSocket((c) => {
      const sessionId = c.req.param("sessionId") ?? "";
      let unsubscribe: (() => boolean) | undefined;
      return {
        onOpen(_event, socket) {
          const snapshot = service.getSnapshot(sessionId);
          if (!snapshot) {
            socket.send(
              JSON.stringify({
                type: "error",
                message: "That Doctor session does not exist.",
              } satisfies DoctorServerEvent),
            );
            socket.close(1008, "Unknown Doctor session");
            return;
          }
          unsubscribe = service.subscribe(sessionId, (event) => socket.send(JSON.stringify(event)));
          for (const event of snapshot.events) socket.send(JSON.stringify(event));
        },
        onMessage(event, socket) {
          try {
            const parsed = clientEventSchema.safeParse(JSON.parse(String(event.data)));
            if (!parsed.success) throw new Error("Invalid Doctor terminal event.");
            if (parsed.data.type === "input") service.write(sessionId, parsed.data.data);
            else service.resize(sessionId, parsed.data.cols, parsed.data.rows);
          } catch (error) {
            socket.send(
              JSON.stringify({
                type: "error",
                message: errorMessage(error, "Invalid Doctor event."),
              } satisfies DoctorServerEvent),
            );
          }
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

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
