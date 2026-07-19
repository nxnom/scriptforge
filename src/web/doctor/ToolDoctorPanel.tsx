import { Alert, LoadingButton, Spinner, toast } from "@geckoui/geckoui";
import { Circle, Square, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DoctorProposal } from "../../server/doctor/types";
import { useRead, useWrite } from "../api";
import { loadForgePreferences } from "../forge/preferences";
import { DoctorProposalPanel } from "./DoctorProposalPanel";
import { type DoctorConnectionState, DoctorTerminal } from "./DoctorTerminal";

export function ToolDoctorPanel({
  toolId,
  onComplete,
  onClose,
}: {
  toolId: string;
  onComplete: () => void | Promise<void>;
  onClose: () => void | Promise<void>;
}) {
  const attempted = useRef(false);
  const completed = useRef(false);
  const [sessionId, setSessionId] = useState<string>();
  const [proposal, setProposal] = useState<DoctorProposal | null>();
  const [verification, setVerification] = useState<{ ready: boolean; message: string }>();
  const [startError, setStartError] = useState<string>();
  const [connection, setConnection] = useState<DoctorConnectionState>("connecting");
  const active = useRead((api) => api("doctor/sessions/active").GET(), { staleTime: 0 });
  const startDoctor = useWrite((api) => api("doctor/sessions").POST());
  const stopDoctor = useWrite((api) => api("doctor/sessions/:sessionId").DELETE());
  const restoredSessionId = active.data?.toolId === toolId ? active.data.sessionId : undefined;
  const visibleSessionId = sessionId ?? restoredSessionId ?? undefined;
  const restoredProposal = active.data?.toolId === toolId ? active.data.proposal : undefined;
  const visibleProposal = proposal === undefined ? (restoredProposal ?? null) : proposal;

  const start = useCallback(async () => {
    setStartError(undefined);
    const response = await startDoctor.trigger({ body: { toolId, ...loadForgePreferences() } });
    if (!response.data?.ok) return setStartError(apiError(response.error));
    setSessionId(response.data.sessionId);
    setProposal(null);
  }, [startDoctor.trigger, toolId]);

  useEffect(() => {
    if (active.loading || visibleSessionId || attempted.current) return;
    attempted.current = true;
    void start();
  }, [active.loading, start, visibleSessionId]);

  const stop = async () => {
    if (!visibleSessionId) return void onClose();
    const response = await stopDoctor.trigger({ params: { sessionId: visibleSessionId } });
    if (!response.data?.ok) return toast.error(apiError(response.error));
    await onClose();
  };
  const verified = useCallback(
    (result: { ready: boolean; message: string }) => {
      setVerification(result);
      if (!result.ready) return;
      completed.current = true;
      void onComplete();
    },
    [onComplete],
  );
  const ended = useCallback(() => {
    if (!completed.current) void onClose();
  }, [onClose]);

  return (
    <section className="flex min-h-0 w-[min(48%,640px)] min-w-105 shrink-0 flex-col overflow-hidden rounded-2xl border border-[#343434] bg-[#171717] max-[980px]:h-[48%] max-[980px]:w-full max-[980px]:min-w-0">
      <header className="flex shrink-0 items-center justify-between gap-3 border-[#303030] border-b bg-[#202020] px-3 py-2">
        <span className="inline-flex items-center gap-2 font-medium text-[#ddd] text-xs">
          <Stethoscope size={14} /> Dependency Doctor
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-[#8f8f8f]">
            <Circle className={connectionColor(connection)} fill="currentColor" size={6} />{" "}
            {connectionLabel(connection)}
          </span>
          <LoadingButton type="button" variant="ghost" size="xs" loading={stopDoctor.loading} onClick={stop}>
            <Square size={10} /> Stop
          </LoadingButton>
        </div>
      </header>
      {verification && !verification.ready && <Alert variant="warning" condensed title={verification.message} />}
      {startError && <Alert variant="error" condensed title="Doctor could not start" description={startError} />}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-2">
        {visibleSessionId ? (
          visibleProposal ? (
            <DoctorProposalPanel
              sessionId={visibleSessionId}
              proposal={visibleProposal}
              onDismiss={() => setProposal(null)}
            />
          ) : (
            <DoctorTerminal
              sessionId={visibleSessionId}
              hideHeader
              onConnectionChange={setConnection}
              onProposal={setProposal}
              onVerification={verified}
              onSessionEnd={ended}
            />
          )
        ) : (
          !startError && (
            <div className="grid flex-1 place-items-center rounded-2xl border border-[#343434] bg-[#171717]">
              <span className="inline-flex items-center gap-2 text-[#929292] text-xs">
                <Spinner /> Starting Codex Doctor…
              </span>
            </div>
          )
        )}
      </div>
    </section>
  );
}

function apiError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The local Codex Doctor could not start.";
}

function connectionColor(connection: DoctorConnectionState) {
  if (connection === "connected") return "text-[#82be8b]";
  if (connection === "installing") return "text-[#e0a24e]";
  if (connection === "error") return "text-[#d87870]";
  return "text-[#8f8f8f]";
}

function connectionLabel(connection: DoctorConnectionState) {
  return {
    connecting: "Connecting",
    connected: "Connected",
    installing: "Installing",
    exited: "Closed",
    error: "Error",
  }[connection];
}
