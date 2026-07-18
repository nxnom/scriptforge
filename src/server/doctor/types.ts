import { z } from "zod";

const installCommandSchema = z.object({
  command: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/),
  args: z
    .array(
      z
        .string()
        .max(500)
        .refine((value) => !value.includes("\0")),
    )
    .max(20),
  explanation: z.string().min(1).max(1_000),
});

export const doctorProposalSchema = z.object({
  summary: z.string().min(1).max(2_000),
  commands: z.array(installCommandSchema).min(1).max(6),
});

export type DoctorProposal = z.infer<typeof doctorProposalSchema> & { createdAt: number };

export type DoctorServerEvent =
  | { type: "output"; data: string }
  | { type: "proposal"; proposal: DoctorProposal | null }
  | { type: "install-start" }
  | { type: "install-output"; data: string }
  | { type: "verification"; ready: boolean; message: string }
  | { type: "exit"; exitCode: number; signal?: number }
  | { type: "error"; message: string };
