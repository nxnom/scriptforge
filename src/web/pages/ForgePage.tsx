import { Button, Dialog } from "@geckoui/geckoui";
import { Bot, Hammer, ShieldCheck, TerminalSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRead, useWrite } from "../api";
import { ForgePreflightDialog } from "../forge/ForgePreflightDialog";
import { ForgeTerminal } from "../forge/ForgeTerminal";
import { type ForgePreferences, loadForgePreferences } from "../forge/preferences";

export function ForgePage() {
  const opened = useRef(false);
  const [preferences, setPreferences] = useState<ForgePreferences>(loadForgePreferences);
  const [sessionId, setSessionId] = useState<string>();
  const [endedSessionId, setEndedSessionId] = useState<string>();
  const activeSession = useRead((api) => api("forge/sessions/active").GET());
  const startForge = useWrite((api) => api("forge/sessions").POST());
  const restoredSessionId = activeSession.data?.sessionId ?? undefined;
  const visibleSessionId = sessionId ?? (restoredSessionId !== endedSessionId ? restoredSessionId : undefined);

  const openPreflight = useCallback(() => {
    Dialog.show({
      className: "w-[min(620px,calc(100vw-24px))] max-w-none border border-[#393939] bg-[#242424] p-5",
      content: ({ dismiss }) => (
        <ForgePreflightDialog
          dismiss={dismiss}
          onContinue={async (next) => {
            const response = await startForge.trigger({ body: next });
            if (!response.data?.ok) throw new Error(forgeError(response.error));
            setPreferences(next);
            setSessionId(response.data.sessionId);
            setEndedSessionId(undefined);
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
  }, []);

  return (
    <section className="flex h-[calc(100dvh-52px)] min-h-0 flex-col gap-4 overflow-hidden max-[760px]:h-[calc(100dvh-88px)] max-[560px]:h-[calc(100dvh-80px)]">
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div>
          <h1 className="m-0 font-[Geist_Variable] text-2xl">Forge</h1>
          <p className="mt-1 mb-0 text-xs text-[#929292]">Build a focused local tool with the interactive Codex CLI.</p>
        </div>
        <Button size="sm" onClick={openPreflight}>
          <Hammer size={14} /> Configure forge
        </Button>
      </header>

      {visibleSessionId ? (
        <ForgeTerminal sessionId={visibleSessionId} onSessionEnd={endSession} />
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
          </div>
        </div>
      )}
    </section>
  );
}

function forgeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The local Codex terminal could not start.";
}
