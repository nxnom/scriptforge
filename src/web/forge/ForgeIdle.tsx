import { Button } from "@geckoui/geckoui";
import { Bot, Hammer, ShieldCheck, TerminalSquare } from "lucide-react";
import { type ForgeDraft, ForgeDraftList } from "./ForgeDraftList";
import type { ForgePreferences } from "./preferences";

type Props = {
  preferences: ForgePreferences;
  drafts: ForgeDraft[];
  draftsLoading: boolean;
  onStart: () => void;
  onResume: (draft: ForgeDraft) => void;
  onDiscard: (draft: ForgeDraft) => void;
};

export function ForgeIdle({ preferences, drafts, draftsLoading, onStart, onResume, onDiscard }: Props) {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[#343434] bg-[#202020] p-8 text-center max-[560px]:p-4">
      <div className="mx-auto grid w-full max-w-2xl gap-7">
        <div className="grid justify-items-center gap-4">
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
          <Button size="sm" onClick={onStart}>
            <Hammer size={14} /> Start new session
          </Button>
        </div>
        <ForgeDraftList drafts={drafts} loading={draftsLoading} onResume={onResume} onDiscard={onDiscard} />
      </div>
    </div>
  );
}
