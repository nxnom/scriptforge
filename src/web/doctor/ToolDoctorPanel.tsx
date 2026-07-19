import { Alert, LoadingButton, Spinner, toast } from "@geckoui/geckoui";
import { Square, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DoctorProposal } from "../../server/doctor/types";
import { useRead, useWrite } from "../api";
import { loadForgePreferences } from "../forge/preferences";
import { DoctorProposalPanel } from "./DoctorProposalPanel";
import { DoctorTerminal } from "./DoctorTerminal";

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
    <section className="flex min-h-0 w-[min(44%,560px)] min-w-96 shrink-0 flex-col gap-2.5 overflow-hidden max-[980px]:h-[48%] max-[980px]:w-full max-[980px]:min-w-0">
      <header className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-[#343434] bg-[#202020] px-3 py-2">
        <span className="inline-flex items-center gap-2 font-medium text-[#ddd] text-xs">
          <Stethoscope size={14} /> Dependency Doctor
        </span>
        <LoadingButton type="button" variant="ghost" size="xs" loading={stopDoctor.loading} onClick={stop}>
          <Square size={11} /> Stop
        </LoadingButton>
      </header>
      {verification && !verification.ready && <Alert variant="warning" condensed title={verification.message} />}
      {startError && <Alert variant="error" condensed title="Doctor could not start" description={startError} />}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
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
