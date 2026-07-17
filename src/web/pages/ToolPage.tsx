import { Alert, Button } from "@geckoui/geckoui";
import { form as spooshForm } from "@spoosh/core";
import { ArrowLeft, Box, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { useRead, useWrite } from "../api";

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
    .min(1)
    .max(10),
});

export function ToolPage() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const [hostError, setHostError] = useState<string>();
  const tools = useRead((api) => api("tools").GET(), { staleTime: 30_000 });
  const startJob = useWrite((api) => api("jobs").POST());
  const tool = tools.data?.tools.find((candidate) => candidate.id === toolId);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isToolMessage(event.data)) return;
      if (event.data.type === "ready") {
        setHostError(undefined);
        iframeRef.current?.contentWindow?.postMessage({ source: "scriptforge-host", type: "ready" }, "*");
        return;
      }
      const message = runMessageSchema.safeParse(event.data);
      if (!message.success) return reportFailure("The tool interface sent an invalid run request.");
      if (!toolId) return reportFailure("The selected tool is unavailable.");
      try {
        setHostError(undefined);
        iframeRef.current?.contentWindow?.postMessage({ source: "scriptforge-host", type: "accepted" }, "*");
        const files = message.data.files.map(normalizeFile);
        const response = await startJob.trigger({
          body: spooshForm({ toolId, input: JSON.stringify(message.data.input), files }),
        });
        if (!response.data?.ok) return reportFailure(apiErrorMessage(response.error));
        connectToJob(response.data.jobId);
      } catch (error) {
        reportFailure(apiErrorMessage(error));
      }
    };

    const reportFailure = (message: string) => {
      setHostError(message);
      iframeRef.current?.contentWindow?.postMessage({ source: "scriptforge-host", type: "failed", message }, "*");
    };
    const connectToJob = (jobId: string) => {
      socketRef.current?.close();
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws/jobs/${jobId}`);
      socketRef.current = socket;
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data));
          iframeRef.current?.contentWindow?.postMessage({ source: "scriptforge-host", ...payload }, "*");
        } catch {
          reportFailure("ScriptForge received an invalid job event.");
        }
      };
      socket.onerror = () => reportFailure("The local job event connection was interrupted.");
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      socketRef.current?.close();
    };
  }, [startJob.trigger, toolId]);

  if (!toolId) return null;

  return (
    <section className="flex min-h-[calc(100vh-52px)] flex-col gap-3.5 max-[680px]:min-h-[calc(100vh-82px)]">
      <header className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3.5 max-[680px]:grid-cols-[auto_1fr]">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft size={14} /> Library
        </Button>
        <div className="flex items-center gap-2.5 max-[680px]:order-first max-[680px]:col-span-full">
          <Box className="box-content rounded-[10px] bg-[#2e2e2e] p-2" size={17} />
          <div>
            <h1 className="m-0 font-[Geist_Variable] text-base">{tool?.name ?? "Tool"}</h1>
            <p className="mt-0.5 mb-0 text-[10px] text-[#7a7a7a]">Sandboxed tool interface</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#333] px-2.5 py-1.5 text-[10px] text-[#b0b0b0] max-[680px]:justify-self-end">
          <ShieldCheck size={13} /> Local execution
        </span>
      </header>
      {hostError && <Alert variant="error" title="Tool host error" description={hostError} condensed />}
      <iframe
        ref={iframeRef}
        className="min-h-180 w-full flex-1 rounded-2xl border border-[#333] bg-[#1a1a1a] max-[680px]:min-h-225"
        src={`/api/tools/${toolId}/ui`}
        title={`${tool?.name ?? "ScriptForge tool"} interface`}
        sandbox="allow-scripts allow-downloads"
      />
    </section>
  );
}

function normalizeFile(file: z.infer<typeof runMessageSchema>["files"][number]) {
  return new File([file.data], file.name, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  });
}

function apiErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The local tool job could not start.";
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
