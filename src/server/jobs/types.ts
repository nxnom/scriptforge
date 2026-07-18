export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface ToolOutput {
  id: string;
  name: string;
  mimeType: string;
  metadata?: unknown;
  previewUrl: string;
  downloadUrl: string;
}

export type ToolJobEvent =
  | { type: "status"; status: JobStatus }
  | { type: "log"; level: "info" | "success" | "warning" | "error"; message: string }
  | { type: "progress"; value: number; label?: string }
  | { type: "result"; outputs: ToolOutput[]; data?: unknown }
  | { type: "complete" }
  | { type: "failed"; message: string };

export interface ToolJobSnapshot {
  id: string;
  toolId: string;
  status: JobStatus;
  events: ToolJobEvent[];
}
