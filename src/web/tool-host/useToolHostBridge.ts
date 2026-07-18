import { useEffect, useState } from "react";
import { z } from "zod";

const runMessageSchema = z.object({
  source: z.literal("scriptforge-tool"),
  type: z.literal("run"),
  input: z.unknown(),
  files: z
    .array(
      z.object({
        name: z.string().min(1),
        size: z.number().nonnegative(),
        type: z.string(),
        lastModified: z.number(),
        data: z.instanceof(ArrayBuffer),
      }),
    )
    .max(10),
});

export type ToolRunMessage = z.infer<typeof runMessageSchema>;
type StartJob = (message: ToolRunMessage) => Promise<{ jobId: string }>;

export function useToolHostBridge({
  iframeRef,
  startJob,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  startJob: StartJob;
}) {
  const [listening, setListening] = useState(false);
  const [hostError, setHostError] = useState<string>();
  const [diagnostics, setDiagnostics] = useState<Array<{ id: string; message: string }>>([]);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let diagnosticId = 0;
    const record = (message: string) =>
      setDiagnostics((current) => [
        ...current.slice(-39),
        { id: `${Date.now()}-${diagnosticId++}`, message: `${new Date().toLocaleTimeString()} · ${message}` },
      ]);
    const post = (message: Record<string, unknown>) => {
      const target = iframeRef.current?.contentWindow;
      if (!target) return record(`Could not deliver ${String(message.type)}: iframe window unavailable`);
      target.postMessage({ source: "scriptforge-host", ...message }, "*");
      record(`Delivered ${String(message.type)} to tool iframe`);
    };
    const fail = (message: string) => {
      setHostError(message);
      record(`Rejected: ${message}`);
      post({ type: "failed", message });
    };
    const connect = (jobId: string) => {
      socket?.close();
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws/jobs/${jobId}`);
      record(`Runner launched as job ${jobId}`);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data));
          record(`Received job event ${String(payload.type)}`);
          post(payload);
        } catch {
          fail("ScriptForge received an invalid job event.");
        }
      };
      socket.onerror = () => fail("The local job event connection was interrupted.");
    };
    const handleMessage = async (event: MessageEvent) => {
      if (!isToolMessage(event.data)) return;
      const sourceMatches = event.source === iframeRef.current?.contentWindow;
      record(`Received ${event.data.type}; source window ${sourceMatches ? "matched" : "did not match"}`);
      if (!sourceMatches) return;
      if (event.data.type === "ready") {
        setHostError(undefined);
        post({ type: "ready" });
        return;
      }
      const parsed = runMessageSchema.safeParse(event.data);
      if (!parsed.success) return fail("The tool interface sent an invalid run request.");
      setHostError(undefined);
      record(`Run request validated with ${parsed.data.files.length} file(s)`);
      post({ type: "accepted" });
      try {
        connect((await startJob(parsed.data)).jobId);
      } catch (error) {
        fail(errorMessage(error));
      }
    };

    window.addEventListener("message", handleMessage);
    record("Host bridge listener installed");
    setListening(true);
    return () => {
      window.removeEventListener("message", handleMessage);
      socket?.close();
    };
  }, [iframeRef, startJob]);

  return { listening, hostError, diagnostics };
}

export function normalizeToolFile(file: ToolRunMessage["files"][number]) {
  return new File([file.data], file.name, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  });
}

function isToolMessage(value: unknown): value is { source: "scriptforge-tool"; type: string } {
  return (
    value !== null &&
    typeof value === "object" &&
    "source" in value &&
    value.source === "scriptforge-tool" &&
    "type" in value &&
    typeof value.type === "string"
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The local tool job could not start.";
}
