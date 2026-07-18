import { Alert, Button } from "@geckoui/geckoui";
import { form as spooshForm } from "@spoosh/core";
import { ArrowLeft, Box, ShieldCheck } from "lucide-react";
import { useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRead, useWrite } from "../api";
import { RequirementNotice } from "../components/RequirementNotice";
import { normalizeToolFile, type ToolRunMessage, useToolHostBridge } from "../tool-host/useToolHostBridge";

export function ToolPage() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tools = useRead((api) => api("tools").GET(), { staleTime: 30_000 });
  const requirements = useRead((api) => api("tools/:toolId/requirements").GET({ params: { toolId: toolId ?? "" } }), {
    enabled: Boolean(toolId),
    staleTime: 5_000,
  });
  const startJob = useWrite((api) => api("jobs").POST());
  const tool = tools.data?.tools.find((candidate) => candidate.id === toolId);
  const runTool = useCallback(
    async (message: ToolRunMessage) => {
      if (!toolId) throw new Error("The selected tool is unavailable.");
      const response = await startJob.trigger({
        body: spooshForm({
          toolId,
          input: JSON.stringify(message.input),
          files: message.files.map(normalizeToolFile),
        }),
      });
      if (!response.data?.ok) throw new Error(apiErrorMessage(response.error));
      return { jobId: response.data.jobId };
    },
    [startJob.trigger, toolId],
  );
  const { listening, hostError } = useToolHostBridge({ iframeRef, startJob: runTool });

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
      {requirements.data?.ok && !requirements.data.ready && (
        <RequirementNotice
          requirements={requirements.data.requirements}
          retry={requirements.trigger}
          launchDoctor={() => navigate(`/doctor/${toolId}`)}
        />
      )}
      <iframe
        ref={iframeRef}
        className="min-h-180 w-full flex-1 rounded-2xl border border-[#333] bg-[#1a1a1a] max-[680px]:min-h-225"
        src={listening ? `/api/tools/${toolId}/ui` : undefined}
        title={`${tool?.name ?? "ScriptForge tool"} interface`}
        sandbox="allow-scripts allow-downloads"
      />
    </section>
  );
}

function apiErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The local tool job could not start.";
}
