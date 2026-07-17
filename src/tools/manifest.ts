import { z } from "zod";

const executableSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1).optional(),
});

const toolInterfaceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("native"), route: z.string().startsWith("/") }),
  z.object({ type: z.literal("html"), entry: z.string().min(1) }),
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
});

export type ToolManifest = z.infer<typeof toolManifestSchema>;
