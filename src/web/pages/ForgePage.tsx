import { Button, ConfirmDialog, Dialog, LoadingButton, toast } from "@geckoui/geckoui";
import { Hammer, Save, Square } from "lucide-react";
import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ForgeCandidateDocument, ForgePanelDocument } from "../../server/forge/types";
import { invalidate, useRead, useWrite } from "../api";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import type { ForgeDraft } from "../forge/ForgeDraftList";
import { ForgeIdle } from "../forge/ForgeIdle";
import { ForgePreflightDialog } from "../forge/ForgePreflightDialog";
import { ForgeSessionWorkspace } from "../forge/ForgeSessionWorkspace";
import { ForgeSidePanel } from "../forge/ForgeSidePanel";
import { forgeError } from "../forge/forgeError";
import { type ForgePreferences, loadForgePreferences } from "../forge/preferences";

export function ForgePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const launchedSessionId = (location.state as { launchedSessionId?: string } | null)?.launchedSessionId;
  const [preferences, setPreferences] = useState<ForgePreferences>(loadForgePreferences);
  const [sessionId, setSessionId] = useState<string | undefined>(launchedSessionId);
  const [endedSessionId, setEndedSessionId] = useState<string>();
  const [panel, setPanel] = useState<ForgePanelDocument | null>(null);
  const [candidate, setCandidate] = useState<ForgeCandidateDocument | null>(null);
  const [savedCandidateRevision, setSavedCandidateRevision] = useState<string>();
  const [savedToolId, setSavedToolId] = useState<string>();
  const activeSession = useRead((api) => api("forge/sessions/active").GET());
  const drafts = useRead((api) => api("forge/sessions").GET(), { staleTime: 0 });
  const startForge = useWrite((api) => api("forge/sessions").POST());
  const resumeForge = useWrite((api) => api("forge/sessions/:sessionId/resume").POST());
  const discardForge = useWrite((api) => api("forge/sessions/:sessionId/draft").DELETE());
  const stopForge = useWrite((api) => api("forge/sessions/:sessionId").DELETE());
  const saveCandidate = useWrite((api) => api("forge/sessions/:sessionId/candidate/save").POST());
  const restoredSessionId = activeSession.data?.sessionId ?? undefined;
  const visibleSessionId = sessionId ?? (restoredSessionId !== endedSessionId ? restoredSessionId : undefined);
  const targetToolId = savedToolId ?? activeSession.data?.toolId ?? undefined;
  const beginSession = useCallback((id: string, next: ForgePreferences) => {
    setPreferences(next);
    setSessionId(id);
    setEndedSessionId(undefined);
    setPanel(null);
    setCandidate(null);
    setSavedCandidateRevision(undefined);
    setSavedToolId(undefined);
  }, []);
  const openPreflight = useCallback(() => {
    Dialog.show({
      className: "w-[min(620px,calc(100vw-24px))] max-w-none overflow-visible border border-[#393939] bg-[#242424] p-5",
      content: ({ dismiss }) => (
        <ForgePreflightDialog
          dismiss={dismiss}
          onContinue={async (next, resumeSessionId) => {
            const response = resumeSessionId
              ? await resumeForge.trigger({ params: { sessionId: resumeSessionId }, body: next })
              : await startForge.trigger({ body: next });
            const data = response.data;
            if (!data?.ok) throw new Error(forgeError(response.error));
            beginSession(data.sessionId, next);
          }}
        />
      ),
    });
  }, [beginSession, resumeForge.trigger, startForge.trigger]);
  const openResume = useCallback(
    (draft: ForgeDraft) => {
      Dialog.show({
        className:
          "w-[min(620px,calc(100vw-24px))] max-w-none overflow-visible border border-[#393939] bg-[#242424] p-5",
        content: ({ dismiss }) => (
          <ForgePreflightDialog
            dismiss={dismiss}
            mode="resume"
            toolName={draft.name}
            onContinue={async (next) => {
              const response = await resumeForge.trigger({ params: { sessionId: draft.sessionId }, body: next });
              if (!response.data?.ok) throw new Error(forgeError(response.error));
              beginSession(response.data.sessionId, next);
              invalidate("forge/sessions");
              invalidate("forge/sessions/active");
            }}
          />
        ),
      });
    },
    [beginSession, resumeForge.trigger],
  );

  const confirmDiscard = useCallback(
    (draft: ForgeDraft) => {
      ConfirmDialog.show({
        title: `Discard ${draft.name}?`,
        content:
          "This permanently removes the staged tool files and saved Forge session. Installed tools are not affected.",
        confirmButtonLabel: "Discard session",
        cancelButtonLabel: "Keep session",
        dismissOnOutsideClick: false,
        onConfirm: async ({ preventDefault, dismiss }) => {
          preventDefault();
          const response = await discardForge.trigger({ params: { sessionId: draft.sessionId } });
          if (!response.data?.ok) return toast.error(forgeError(response.error));
          invalidate("forge/sessions");
          toast.success(`${draft.name} was discarded.`);
          dismiss();
        },
      });
    },
    [discardForge.trigger],
  );

  const endSession = useCallback((endedId: string) => {
    setEndedSessionId(endedId);
    setSessionId(undefined);
    setPanel(null);
    setCandidate(null);
    setSavedCandidateRevision(undefined);
    setSavedToolId(undefined);
    invalidate("forge/sessions");
  }, []);
  const showPanel = useCallback((next: ForgePanelDocument | null) => {
    setPanel(next);
  }, []);
  const showCandidate = useCallback((next: ForgeCandidateDocument) => {
    setCandidate(next);
    setPanel(null);
  }, []);
  const stopSession = async () => {
    if (!visibleSessionId) return;
    const response = await stopForge.trigger({
      params: { sessionId: visibleSessionId },
      query: { discard: targetToolId ? "true" : "false" },
    });
    if (!response.data?.ok) {
      toast.error(forgeError(response.error));
      return;
    }
    endSession(visibleSessionId);
    navigate("/", { replace: true });
    return true;
  };
  const confirmStopSession = () => {
    ConfirmDialog.show({
      title: "Stop this Forge session?",
      content: targetToolId
        ? "The temporary Forge workspace will be deleted. Your saved tool stays in the Library, but changes made since the last Save changes will be discarded."
        : "The interactive Codex terminal will close. Its conversation and staged files will remain available to resume later.",
      confirmButtonLabel: "Stop session",
      cancelButtonLabel: "Keep working",
      dismissOnOutsideClick: false,
      onConfirm: async ({ preventDefault, dismiss }) => {
        preventDefault();
        if (await stopSession()) dismiss();
      },
    });
  };
  const save = async () => {
    if (!visibleSessionId || !candidate) return;
    const response = await saveCandidate.trigger({
      params: { sessionId: visibleSessionId },
      body: { revision: candidate.revision },
    });
    if (!response.data?.ok) return toast.error(forgeError(response.error));
    invalidate("tools");
    invalidate("forge/sessions/active");
    setSavedToolId(response.data.tool.id);
    setSavedCandidateRevision(candidate.revision);
    toast.success(
      response.data.action === "updated"
        ? `${response.data.tool.name} was updated.`
        : `${response.data.tool.name} was saved to your library.`,
    );
  };

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <WorkspaceHeader
        title="Forge"
        subtitle="Build a focused local tool with the interactive Codex CLI."
        onBack={() => navigate("/")}
        actions={
          <>
            {visibleSessionId && (
              <LoadingButton variant="ghost" size="sm" loading={stopForge.loading} onClick={confirmStopSession}>
                <Square size={12} /> Stop session
              </LoadingButton>
            )}
            {visibleSessionId && candidate && candidate.revision !== savedCandidateRevision && (
              <LoadingButton variant="outlined" size="sm" loading={saveCandidate.loading} onClick={save}>
                <Save size={13} />
                {targetToolId ? "Save changes" : "Save tool"}
              </LoadingButton>
            )}
            {!visibleSessionId && (
              <Button size="sm" onClick={openPreflight}>
                <Hammer size={14} /> Start session
              </Button>
            )}
          </>
        }
      />

      <div className="flex min-h-0 w-full flex-1 overflow-hidden px-10 pt-6 pb-6 max-[900px]:px-6 max-[560px]:px-4 max-[560px]:pt-4 max-[560px]:pb-4">
        <div className="mx-auto flex min-h-0 w-full max-w-320 flex-1 flex-col overflow-hidden">
          {visibleSessionId ? (
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              {panel ? (
                <ForgeSidePanel
                  sessionId={visibleSessionId}
                  panel={panel}
                  onResolved={() => setPanel(null)}
                  onSubmissionError={() => setPanel(panel)}
                />
              ) : (
                <ForgeSessionWorkspace
                  sessionId={visibleSessionId}
                  candidate={candidate}
                  onSessionEnd={endSession}
                  onPanel={showPanel}
                  onCandidate={showCandidate}
                />
              )}
            </div>
          ) : (
            <ForgeIdle
              preferences={preferences}
              drafts={(drafts.data?.sessions ?? []) as ForgeDraft[]}
              draftsLoading={drafts.loading}
              onStart={openPreflight}
              onResume={openResume}
              onDiscard={confirmDiscard}
            />
          )}
        </div>
      </div>
    </section>
  );
}
