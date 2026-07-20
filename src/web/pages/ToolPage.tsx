import { Alert, ConfirmDialog, Dialog, toast } from "@geckoui/geckoui";
import { form as spooshForm } from "@spoosh/core";
import { useCallback, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ForgeCandidateDocument, ForgePanelDocument } from "../../server/forge/types";
import { invalidate, useRead, useWrite } from "../api";
import { apiErrorMessage } from "../api-error";
import { ToolActions } from "../components/ToolActions";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { openInstalledConfiguration } from "../configuration/ToolConfigurationDialog";
import { ToolDoctorPanel } from "../doctor/ToolDoctorPanel";
import { ForgePreflightDialog } from "../forge/ForgePreflightDialog";
import { ToolInfoSidebar } from "../tool-detail/ToolInfoSidebar";
import { ToolReview } from "../tool-detail/ToolReview";
import { ToolUpdateActions } from "../tool-detail/ToolUpdateActions";
import { ToolUpdateWorkspace } from "../tool-detail/ToolUpdateWorkspace";
import { normalizeToolFile, type ToolRunMessage, useToolHostBridge } from "../tool-host/useToolHostBridge";

export function ToolPage() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [updateSessionId, setUpdateSessionId] = useState<string>();
  const [endedSessionId, setEndedSessionId] = useState<string>();
  const [panel, setPanel] = useState<ForgePanelDocument | null>(null);
  const [candidate, setCandidate] = useState<ForgeCandidateDocument | null>(null);
  const [candidateTested, setCandidateTested] = useState(false);
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
  const activeForge = useRead((api) => api("forge/sessions/active").GET(), { staleTime: 0 });
  const configurationRef = useRef(configuration);
  configurationRef.current = configuration;
  const startJob = useWrite((api) => api("jobs").POST());
  const startUpdate = useWrite((api) => api("forge/sessions").POST());
  const stopUpdate = useWrite((api) => api("forge/sessions/:sessionId").DELETE());
  const saveUpdate = useWrite((api) => api("forge/sessions/:sessionId/candidate/save").POST());
  const tool = tools.data?.tools.find((candidate) => candidate.id === toolId);
  const restoredUpdateId = activeForge.data?.sessions?.find(
    (session) => session.scope === "update" && session.toolId === toolId,
  )?.sessionId;
  const visibleUpdateId = updateSessionId ?? (restoredUpdateId !== endedSessionId ? restoredUpdateId : undefined);
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
      if (!response.data?.ok) throw new Error(apiErrorMessage(response.error, "The local tool job could not start."));
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
  const configureTool = useCallback(() => {
    if (!toolId) return;
    void openInstalledConfiguration(toolId).then((saved) => {
      if (saved) void configuration.trigger();
    });
  }, [configuration.trigger, toolId]);

  const endUpdate = useCallback((sessionId: string) => {
    setEndedSessionId(sessionId);
    setUpdateSessionId(undefined);
    setPanel(null);
    setCandidate(null);
    setCandidateTested(false);
    invalidate("forge/sessions/active");
  }, []);
  const openUpdate = () => {
    if (!toolId) return;
    Dialog.show({
      className: "w-[min(620px,calc(100vw-24px))] max-w-none overflow-visible border border-[#393939] bg-[#242424] p-5",
      content: ({ dismiss }) => (
        <ForgePreflightDialog
          dismiss={dismiss}
          mode="update"
          toolName={tool?.name}
          onContinue={async (preferences) => {
            const response = await startUpdate.trigger({ body: { ...preferences, toolId } });
            if (!response.data?.ok) throw new Error(apiErrorMessage(response.error, "The update could not start."));
            setUpdateSessionId(response.data.sessionId);
            setEndedSessionId(undefined);
            setPanel(null);
            setCandidate(null);
            setCandidateTested(false);
            setDoctorOpen(false);
            invalidate("forge/sessions/active");
          }}
        />
      ),
    });
  };
  const confirmStopUpdate = () => {
    if (!visibleUpdateId) return;
    ConfirmDialog.show({
      title: "Stop this update session?",
      content:
        "The temporary update workspace will be deleted. Saved changes stay installed, but later unsaved edits will be discarded.",
      confirmButtonLabel: "Stop session",
      cancelButtonLabel: "Keep working",
      dismissOnOutsideClick: false,
      onConfirm: async ({ preventDefault, dismiss }) => {
        preventDefault();
        const response = await stopUpdate.trigger({
          params: { sessionId: visibleUpdateId },
          query: { discard: "true" },
        });
        if (!response.data?.ok)
          return toast.error(apiErrorMessage(response.error, "The update session could not stop."));
        endUpdate(visibleUpdateId);
        dismiss();
      },
    });
  };
  const saveCandidateUpdate = async () => {
    if (!visibleUpdateId || !candidate) return;
    const response = await saveUpdate.trigger({
      params: { sessionId: visibleUpdateId },
      body: { revision: candidate.revision },
    });
    if (!response.data?.ok) return toast.error(apiErrorMessage(response.error, "The tool could not be updated."));
    invalidate("tools");
    setCandidateTested(false);
    toast.success(`${response.data.tool.name} was updated.`);
  };
  if (!toolId) return null;
  const installedTool = Boolean(tool && "origin" in tool && tool.origin === "installed");

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden max-[760px]:overflow-y-auto">
      <WorkspaceHeader
        title={tool?.name ?? "Tool"}
        subtitle={visibleUpdateId ? "Update with Codex and test the reviewed revision." : "Sandboxed tool interface"}
        onBack={() => navigate("/")}
        actions={
          tool ? (
            <>
              <ToolUpdateActions
                installed={installedTool}
                sessionActive={Boolean(visibleUpdateId)}
                candidateReady={Boolean(candidate)}
                candidateTested={candidateTested}
                stopping={stopUpdate.loading}
                saving={saveUpdate.loading}
                start={openUpdate}
                stop={confirmStopUpdate}
                save={saveCandidateUpdate}
              />
              {!visibleUpdateId &&
                (installedTool || (configuration.data?.ok && configuration.data.fields.length > 0)) && (
                  <ToolActions
                    toolId={toolId}
                    toolName={tool.name}
                    mode="responsive"
                    manageable={installedTool}
                    onConfigure={
                      configuration.data?.ok && configuration.data.fields.length > 0 ? configureTool : undefined
                    }
                  />
                )}
            </>
          ) : undefined
        }
      />
      <div className="flex min-h-0 w-full flex-1 overflow-hidden px-10 pt-7.5 pb-6 max-[900px]:px-6 max-[560px]:px-4 max-[560px]:pt-5 max-[560px]:pb-4">
        <div className="mx-auto flex min-h-0 w-full max-w-320 flex-1 flex-col gap-4 overflow-hidden">
          {toolReady && hostError && (
            <Alert variant="error" title="Tool host error" description={hostError} condensed />
          )}
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden max-[760px]:min-h-[calc(100dvh-7rem)]">
            {visibleUpdateId && requirements.data?.ok && tool && "origin" in tool && (
              <ToolUpdateWorkspace
                sessionId={visibleUpdateId}
                panel={panel}
                candidate={candidate}
                onSessionEnd={endUpdate}
                onPanel={setPanel}
                onCandidate={(next) => {
                  setCandidate(next);
                  setCandidateTested(false);
                  setPanel(null);
                }}
                onTestStatusChange={setCandidateTested}
                installedReview={
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
                }
              />
            )}
            {!visibleUpdateId && doctorVisible && (
              <ToolDoctorPanel toolId={toolId} standalone onComplete={completeDoctor} onClose={closeDoctor} />
            )}
            {!visibleUpdateId && !doctorVisible && requirements.data?.ok && tool && "origin" in tool && (
              <div className="flex min-h-0 min-w-0 flex-1 gap-6 overflow-hidden max-[900px]:flex-col max-[760px]:overflow-visible">
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
        </div>
      </div>
    </section>
  );
}
