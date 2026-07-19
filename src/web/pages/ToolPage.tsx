import { Alert, Button, Tooltip } from "@geckoui/geckoui";
import { form as spooshForm } from "@spoosh/core";
import { ArrowLeft, Settings2, ShieldCheck } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { invalidate, useRead, useWrite } from "../api";
import { ToolActions } from "../components/ToolActions";
import { openInstalledConfiguration } from "../configuration/ToolConfigurationDialog";
import { ToolDoctorPanel } from "../doctor/ToolDoctorPanel";
import { ToolInfoSidebar } from "../tool-detail/ToolInfoSidebar";
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
    <section className="mx-auto flex min-h-0 w-full max-w-350 flex-1 flex-col gap-4 overflow-hidden max-[760px]:overflow-y-auto">
      <header className="flex min-h-13 items-center gap-4 border-[#303030] border-b pb-3 max-[680px]:flex-wrap">
        <Button className="shrink-0" variant="outlined" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft size={14} /> Library
        </Button>
        <span aria-hidden="true" className="h-7 w-px bg-[#303030]" />
        <div className="min-w-0 flex-1">
          <div>
            <h1 className="m-0 truncate font-[Geist_Variable] text-[17px]">{tool?.name ?? "Tool"}</h1>
            <p className="mt-0.5 mb-0 text-[10px] text-[#858585]">Sandboxed tool interface</p>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {configuration.data?.ok && configuration.data.fields.length > 0 && (
            <Tooltip content="Tool configuration" triggerAsChild>
              <Button
                aria-label="Tool configuration"
                className="size-9"
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
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-[#333] bg-[#202020] px-2.5 py-1.5 text-[10px] text-[#b0b0b0]">
            <ShieldCheck size={13} /> Local execution
          </span>
        </div>
      </header>
      {toolReady && hostError && <Alert variant="error" title="Tool host error" description={hostError} condensed />}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden max-[760px]:min-h-225">
        {doctorVisible && (
          <ToolDoctorPanel toolId={toolId} standalone onComplete={completeDoctor} onClose={closeDoctor} />
        )}
        {!doctorVisible && requirements.data?.ok && tool && "origin" in tool && (
          <div className="flex min-h-0 min-w-0 flex-1 gap-5 overflow-hidden max-[960px]:flex-col max-[760px]:overflow-visible">
            <ToolInfoSidebar tool={tool} requirements={requirements.data.requirements} />
            <ToolReview
              toolId={toolId}
              toolName={tool.name}
              toolReady={toolReady}
              listening={listening}
              configurationLoading={configuration.loading}
              iframeRef={iframeRef}
              requirements={requirements.data.requirements}
              retryRequirements={requirements.trigger}
              launchDoctor={() => setDoctorOpen(true)}
            />
          </div>
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
