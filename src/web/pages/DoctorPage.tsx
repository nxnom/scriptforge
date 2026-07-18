import { Alert, Button, LoadingButton, toast } from "@geckoui/geckoui";
import { ArrowLeft, Bot, Square, Stethoscope } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { DoctorProposal } from "../../server/doctor/types";
import { invalidate, useRead, useWrite } from "../api";
import { DoctorProposalPanel } from "../doctor/DoctorProposalPanel";
import { DoctorTerminal } from "../doctor/DoctorTerminal";
import { loadForgePreferences } from "../forge/preferences";

export function DoctorPage() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string>();
  const [proposal, setProposal] = useState<DoctorProposal | null>(null);
  const [verification, setVerification] = useState<{ ready: boolean; message: string }>();
  const [startError, setStartError] = useState<string>();
  const tools = useRead((api) => api("tools").GET(), { staleTime: 5_000 });
  const activeSession = useRead((api) => api("doctor/sessions/active").GET(), {
    enabled: Boolean(toolId),
    staleTime: 0,
  });
  const requirements = useRead((api) => api("tools/:toolId/requirements").GET({ params: { toolId: toolId ?? "" } }), {
    enabled: Boolean(toolId),
    staleTime: 5_000,
  });
  const startDoctor = useWrite((api) => api("doctor/sessions").POST());
  const stopDoctor = useWrite((api) => api("doctor/sessions/:sessionId").DELETE());
  const tool = tools.data?.tools.find((candidate) => candidate.id === toolId);
  const activeSessionId = activeSession.data?.toolId === toolId ? activeSession.data?.sessionId : undefined;
  const visibleSessionId = sessionId ?? activeSessionId ?? undefined;
  const missing = requirements.data?.ok
    ? requirements.data.requirements.filter((requirement) => !requirement.available)
    : [];
  const start = async () => {
    if (!toolId) return;
    setStartError(undefined);
    const response = await startDoctor.trigger({ body: { toolId, ...loadForgePreferences() } });
    if (!response.data?.ok) return setStartError(apiError(response.error));
    setSessionId(response.data.sessionId);
  };
  const stop = async () => {
    if (!visibleSessionId) return;
    const response = await stopDoctor.trigger({ params: { sessionId: visibleSessionId } });
    if (!response.data?.ok) return toast.error(apiError(response.error));
    setSessionId(undefined);
    setProposal(null);
    activeSession.trigger();
  };
  const verified = useCallback(
    (result: { ready: boolean; message: string }) => {
      setVerification(result);
      requirements.trigger();
      invalidate("tools");
    },
    [requirements.trigger],
  );
  const sessionEnded = useCallback(() => {
    setSessionId(undefined);
    activeSession.trigger();
  }, [activeSession.trigger]);

  return (
    <section className="flex h-[calc(100dvh-52px)] min-h-0 flex-col gap-4 overflow-hidden">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(toolId ? `/tools/${toolId}` : "/")}>
            <ArrowLeft size={14} /> Tool
          </Button>
          <div>
            <h1 className="m-0 font-[Geist_Variable] text-xl">Dependency Doctor</h1>
            <p className="mt-1 mb-0 text-xs text-[#929292]">{tool?.name ?? "Local tool"}</p>
          </div>
        </div>
        {visibleSessionId && (
          <LoadingButton variant="ghost" size="sm" loading={stopDoctor.loading} onClick={stop}>
            <Square size={12} /> Stop Doctor
          </LoadingButton>
        )}
      </header>

      {verification && (
        <Alert variant={verification.ready ? "success" : "warning"} condensed title={verification.message} />
      )}
      {startError && <Alert variant="error" condensed title="Doctor could not start" description={startError} />}

      {visibleSessionId ? (
        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden max-[900px]:flex-col">
          <DoctorTerminal
            sessionId={visibleSessionId}
            onProposal={setProposal}
            onVerification={verified}
            onSessionEnd={sessionEnded}
          />
          {proposal && (
            <DoctorProposalPanel sessionId={visibleSessionId} proposal={proposal} onDismiss={() => setProposal(null)} />
          )}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center rounded-2xl border border-[#343434] bg-[#202020] p-6">
          <div className="grid max-w-lg justify-items-center gap-4 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-[#2d2d2d]">
              <Stethoscope size={22} />
            </span>
            <div>
              <h2 className="m-0 font-[Geist_Variable] text-lg">Get installation help from Codex</h2>
              <p className="mt-2 mb-0 text-xs leading-5 text-[#929292]">
                Doctor will inspect your machine and propose exact commands. It will not run anything until you review
                and approve them.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {missing.map((requirement) => (
                <code
                  className="rounded-full border border-[#3b3b3b] bg-[#191919] px-3 py-1.5 text-[11px]"
                  key={requirement.name}
                >
                  {requirement.name} {requirement.version ?? ""}
                </code>
              ))}
            </div>
            <LoadingButton size="sm" loading={startDoctor.loading} disabled={!missing.length} onClick={start}>
              <Bot size={14} /> Launch Codex Doctor
            </LoadingButton>
          </div>
        </div>
      )}
    </section>
  );
}

function apiError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The local Codex Doctor could not start.";
}
