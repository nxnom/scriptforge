import { z } from "zod";

const executableSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/),
  version: z.string().min(1).optional(),
});

const toolInterfaceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("native"), route: z.string().startsWith("/") }),
  z.object({ type: z.literal("html"), entry: z.string().min(1) }),
]);

const configurationBase = {
  key: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(240).optional(),
  required: z.boolean().default(false),
};

const configurationFieldSchema = z.discriminatedUnion("type", [
  z.object({
    ...configurationBase,
    type: z.literal("text"),
    placeholder: z.string().max(120).optional(),
    defaultValue: z.string().max(8_000).optional(),
  }),
  z.object({
    ...configurationBase,
    type: z.literal("secret"),
    placeholder: z.string().max(120).optional(),
  }),
  z.object({
    ...configurationBase,
    type: z.literal("textarea"),
    placeholder: z.string().max(120).optional(),
    defaultValue: z.string().max(8_000).optional(),
  }),
  z.object({
    ...configurationBase,
    type: z.literal("number"),
    minimum: z.number().finite().optional(),
    maximum: z.number().finite().optional(),
    defaultValue: z.number().finite().optional(),
  }),
  z.object({
    ...configurationBase,
    type: z.literal("boolean"),
    defaultValue: z.boolean().optional(),
  }),
  z.object({
    ...configurationBase,
    type: z.literal("select"),
    options: z
      .array(z.object({ value: z.string().min(1).max(120), label: z.string().min(1).max(120) }))
      .min(1)
      .max(50),
    defaultValue: z.string().max(120).optional(),
  }),
]);

export const toolManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  icon: z.string().min(1),
  script: z.string().min(1),
  interface: toolInterfaceSchema,
  requiredExecutables: z.array(executableSchema),
  configuration: z
    .array(configurationFieldSchema)
    .max(24)
    .refine(
      (fields) => new Set(fields.map((field) => field.key)).size === fields.length,
      "Configuration keys must be unique.",
    )
    .refine(
      (fields) =>
        fields.every((field) => {
          if (field.type === "select" && field.defaultValue !== undefined) {
            return field.options.some((option) => option.value === field.defaultValue);
          }
          if (field.type === "number" && field.defaultValue !== undefined) {
            return (
              (field.minimum === undefined || field.defaultValue >= field.minimum) &&
              (field.maximum === undefined || field.defaultValue <= field.maximum)
            );
          }
          return true;
        }),
      "Configuration defaults must match their field constraints.",
    )
    .default([]),
});

export type ToolManifest = z.infer<typeof toolManifestSchema>;
export type ToolConfigurationField = ToolManifest["configuration"][number];
