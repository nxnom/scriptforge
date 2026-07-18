import { z } from "zod";

export const forgeModels = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.2",
] as const;

export const forgeEfforts = ["minimal", "low", "medium", "high", "xhigh"] as const;

export type ForgePreferences = {
  model: (typeof forgeModels)[number];
  effort: (typeof forgeEfforts)[number];
};

const panelChoiceSchema = z.object({
  value: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  description: z.string().max(500).optional(),
});

const panelQuestionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("single_choice"),
    name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,79}$/),
    required: z.boolean().optional(),
    options: z.array(panelChoiceSchema).min(1).max(12),
    defaultValue: z.string().min(1).max(120).optional(),
  }),
  z.object({
    kind: z.literal("multi_choice"),
    name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,79}$/),
    required: z.boolean().optional(),
    options: z.array(panelChoiceSchema).min(1).max(12),
    defaultValue: z.array(z.string().min(1).max(120)).max(12).optional(),
  }),
  z.object({
    kind: z.literal("text"),
    name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,79}$/),
    required: z.boolean().optional(),
    placeholder: z.string().max(240).optional(),
    multiline: z.boolean().optional(),
    defaultValue: z.string().max(8_000).optional(),
  }),
]);

export const forgePanelRequestSchema = z
  .object({
    title: z.string().min(1).max(120),
    blocks: z
      .array(
        z.discriminatedUnion("type", [
          z.object({ id: z.string().min(1).max(80), type: z.literal("markdown"), body: z.string().max(40_000) }),
          z.object({ id: z.string().min(1).max(80), type: z.literal("html"), body: z.string().max(80_000) }),
          z.object({
            id: z.string().min(1).max(80),
            type: z.literal("diagram"),
            format: z.literal("mermaid"),
            source: z.string().min(1).max(40_000),
            caption: z.string().max(500).optional(),
          }),
          z.object({
            id: z.string().min(1).max(80),
            type: z.literal("question"),
            prompt: z.string().min(1).max(1_000),
            input: panelQuestionSchema,
          }),
          z.object({
            id: z.string().min(1).max(80),
            type: z.literal("approval"),
            title: z.string().min(1).max(160),
            description: z.string().min(1).max(2_000),
            approveLabel: z.string().min(1).max(60).optional(),
            rejectLabel: z.string().min(1).max(60).optional(),
          }),
        ]),
      )
      .min(1)
      .max(24),
  })
  .refine((panel) => panel.blocks.some((block) => block.type === "question" || block.type === "approval"), {
    message: "A Forge panel must ask a question or request approval.",
    path: ["blocks"],
  })
  .superRefine((panel, context) => {
    for (const [index, block] of panel.blocks.entries()) {
      if (block.type !== "question" || block.input.kind === "text" || block.input.defaultValue === undefined) continue;
      const allowed = new Set(block.input.options.map((option) => option.value));
      const defaults = Array.isArray(block.input.defaultValue) ? block.input.defaultValue : [block.input.defaultValue];
      if (defaults.every((value) => allowed.has(value))) continue;
      context.addIssue({
        code: "custom",
        path: ["blocks", index, "input", "defaultValue"],
        message: "Every default choice must match an option value.",
      });
    }
  });

export const forgeCandidateRequestSchema = z.object({
  summary: z.string().min(1).max(4_000),
  testSummary: z.string().min(1).max(1_000),
  risks: z.array(z.string().min(1).max(1_000)).max(12).optional(),
});

export type ForgePanelRequest = z.infer<typeof forgePanelRequestSchema>;
export type ForgePanelBlock = ForgePanelRequest["blocks"][number];
export type ForgePanelDocument = ForgePanelRequest & { version: number; createdAt: number };
export type ForgeCandidateRequest = z.infer<typeof forgeCandidateRequestSchema>;
export type ForgeCandidateDocument = ForgeCandidateRequest & {
  name: string;
  description: string;
  requiredExecutables: Array<{ name: string; version?: string }>;
  manifestSource: string;
  scriptSource: string;
  interfaceHtml: string;
  revision: string;
  createdAt: number;
};

export type ForgeServerEvent =
  | { type: "output"; data: string }
  | { type: "panel"; panel: ForgePanelDocument | null }
  | { type: "candidate"; candidate: ForgeCandidateDocument }
  | { type: "exit"; exitCode: number; signal?: number }
  | { type: "error"; message: string };
