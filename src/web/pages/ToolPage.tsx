import { Alert, Button, Tooltip } from "@geckoui/geckoui";
import { form as spooshForm } from "@spoosh/core";
import { ArrowLeft, Box, Settings2, ShieldCheck } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { invalidate, useRead, useWrite } from "../api";
import { ToolActions } from "../components/ToolActions";
import { openInstalledConfiguration } from "../configuration/ToolConfigurationDialog";
import { ToolDoctorPanel } from "../doctor/ToolDoctorPanel";
import { ToolReview } from "../tool-detail/ToolReview";
import { normalizeToolFile, type ToolRunMessage, useToolHostBridge } from "../tool-host/useToolHostBridge";

export function ToolPage() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const [doctorOpen, setDoctorOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tools = useRead((api) => api("tools").GET(), { staleTime: 30_000 });
  const requirements = useRead((api) => api("tools/:toolId/requirements").GET({ params: { toolId: toolId ?? "" } }), {
    enabled: Boolean(toolId),
    staleTime: 5_000,
  });
  const configuration = useRead((api) => api("tools/:toolId/configuration").GET({ params: { toolId: toolId ?? "" } }), {
    enabled: Boolean(toolId),
    staleTime: 0,
  });
  const activeDoctor = useRead((api) => api("doctor/sessions/active").GET(), { staleTime: 0 });
  const configurationRef = useRef(configuration);
  configurationRef.current = configuration;
  const startJob = useWrite((api) => api("jobs").POST());
  const tool = tools.data?.tools.find((candidate) => candidate.id === toolId);
  const runTool = useCallback(
    async (message: ToolRunMessage) => {
      if (!toolId) throw new Error("The selected tool is unavailable.");
      if (configurationRef.current.data?.ok && !configurationRef.current.data.ready) {
        const saved = await openInstalledConfiguration(toolId);
        if (!saved) throw new Error("Add the required configuration to run this tool.");
        await configurationRef.current.trigger();
      }
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
  const toolReady = requirements.data?.ok === true && requirements.data.ready;
  const { listening, hostError } = useToolHostBridge({ iframeRef, startJob: runTool, enabled: toolReady });
  const doctorVisible = doctorOpen || activeDoctor.data?.toolId === toolId;
  const closeDoctor = useCallback(async () => {
    await activeDoctor.trigger();
    setDoctorOpen(false);
  }, [activeDoctor.trigger]);
  const completeDoctor = useCallback(async () => {
    await Promise.all([requirements.trigger(), activeDoctor.trigger()]);
    invalidate("tools");
    setDoctorOpen(false);
  }, [activeDoctor.trigger, requirements.trigger]);

  if (!toolId) return null;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-hidden max-[760px]:overflow-y-auto">
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
        <div className="flex items-center gap-2 max-[680px]:justify-self-end">
          {configuration.data?.ok && configuration.data.fields.length > 0 && (
            <Tooltip content="Tool configuration" triggerAsChild>
              <Button
                aria-label="Tool configuration"
                variant="icon"
                size="sm"
                onClick={() => navigate(`/tools/${toolId}/settings`)}
              >
                <Settings2 size={14} />
              </Button>
            </Tooltip>
          )}
          {tool && "origin" in tool && tool.origin === "installed" && (
            <ToolActions toolId={toolId} toolName={tool.name} />
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#333] px-2.5 py-1.5 text-[10px] text-[#b0b0b0]">
            <ShieldCheck size={13} /> Local execution
          </span>
        </div>
      </header>
      {toolReady && hostError && <Alert variant="error" title="Tool host error" description={hostError} condensed />}
      <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden max-[980px]:flex-col max-[760px]:min-h-225">
        {doctorVisible && (
          <ToolDoctorPanel toolId={toolId} standalone onComplete={completeDoctor} onClose={closeDoctor} />
        )}
        {!doctorVisible && requirements.data?.ok && (
          <ToolReview
            toolId={toolId}
            toolName={tool?.name ?? "ScriptForge tool"}
            toolReady={toolReady}
            listening={listening}
            configurationLoading={configuration.loading}
            iframeRef={iframeRef}
            requirements={requirements.data.requirements}
            retryRequirements={requirements.trigger}
            launchDoctor={() => setDoctorOpen(true)}
          />
        )}
      </div>
    </section>
  );
}

function apiErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The local tool job could not start.";
}
