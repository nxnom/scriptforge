import { Button, Dialog, LoadingButton, toast } from "@geckoui/geckoui";
import { Bot, Hammer, ShieldCheck, Square, TerminalSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ForgeCandidateDocument, ForgePanelDocument } from "../../server/forge/types";
import { useRead, useWrite } from "../api";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { CandidateReview } from "../forge/CandidateReview";
import { ForgePreflightDialog } from "../forge/ForgePreflightDialog";
import { ForgeSidePanel } from "../forge/ForgeSidePanel";
import { ForgeTerminal } from "../forge/ForgeTerminal";
import { type ForgePreferences, loadForgePreferences } from "../forge/preferences";

export function ForgePage() {
  const navigate = useNavigate();
  const opened = useRef(false);
  const [preferences, setPreferences] = useState<ForgePreferences>(loadForgePreferences);
  const [sessionId, setSessionId] = useState<string>();
  const [endedSessionId, setEndedSessionId] = useState<string>();
  const [panel, setPanel] = useState<ForgePanelDocument | null>(null);
  const [candidate, setCandidate] = useState<ForgeCandidateDocument | null>(null);
  const activeSession = useRead((api) => api("forge/sessions/active").GET());
  const startForge = useWrite((api) => api("forge/sessions").POST());
  const stopForge = useWrite((api) => api("forge/sessions/:sessionId").DELETE());
  const restoredSessionId = activeSession.data?.sessionId ?? undefined;
  const visibleSessionId = sessionId ?? (restoredSessionId !== endedSessionId ? restoredSessionId : undefined);

  const openPreflight = useCallback(() => {
    Dialog.show({
      className: "w-[min(620px,calc(100vw-24px))] max-w-none overflow-visible border border-[#393939] bg-[#242424] p-5",
      content: ({ dismiss }) => (
        <ForgePreflightDialog
          dismiss={dismiss}
          onContinue={async (next) => {
            const response = await startForge.trigger({ body: next });
            if (!response.data?.ok) throw new Error(forgeError(response.error));
            setPreferences(next);
            setSessionId(response.data.sessionId);
            setEndedSessionId(undefined);
            setPanel(null);
            setCandidate(null);
          }}
        />
      ),
    });
  }, [startForge.trigger]);

  useEffect(() => {
    if (activeSession.loading || visibleSessionId || opened.current) return;
    opened.current = true;
    openPreflight();
  }, [activeSession.loading, openPreflight, visibleSessionId]);

  const endSession = useCallback((endedId: string) => {
    setEndedSessionId(endedId);
    setSessionId(undefined);
    setPanel(null);
    setCandidate(null);
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
    const response = await stopForge.trigger({ params: { sessionId: visibleSessionId } });
    if (!response.data?.ok) {
      toast.error(forgeError(response.error));
      return;
    }
    opened.current = true;
    endSession(visibleSessionId);
    navigate("/", { replace: true });
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
              <LoadingButton variant="ghost" size="sm" loading={stopForge.loading} onClick={stopSession}>
                <Square size={12} /> Stop session
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
                <div className="flex min-h-0 flex-1 gap-3 overflow-hidden max-[900px]:flex-col">
                  <ForgeTerminal
                    sessionId={visibleSessionId}
                    onSessionEnd={endSession}
                    onPanel={showPanel}
                    onCandidate={showCandidate}
                  />
                  {candidate && (
                    <CandidateReview
                      candidate={candidate}
                      sessionId={visibleSessionId}
                      onSaved={(tool) => navigate(`/tools/${tool.id}`, { replace: true })}
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 place-items-center overflow-hidden rounded-2xl border border-[#343434] bg-[#202020] p-8 text-center">
              <div className="grid max-w-md justify-items-center gap-4">
                <span className="grid size-12 place-items-center rounded-2xl bg-[#2d2d2d]">
                  <TerminalSquare size={22} />
                </span>
                <div>
                  <h2 className="m-0 font-[Geist_Variable] text-lg">Configure Codex to begin</h2>
                  <p className="mt-2 mb-0 text-xs leading-5 text-[#8f8f8f]">
                    ScriptForge checks your local Codex installation before opening an interactive session.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 text-[10px] text-[#aaa]">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#383838] px-2.5 py-1.5">
                    <Bot size={12} /> {preferences.model}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#383838] px-2.5 py-1.5">
                    <ShieldCheck size={12} /> {preferences.effort} effort
                  </span>
                </div>
                <Button size="sm" onClick={openPreflight}>
                  <Hammer size={14} /> Start new session
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function forgeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The local Codex terminal could not start.";
}
