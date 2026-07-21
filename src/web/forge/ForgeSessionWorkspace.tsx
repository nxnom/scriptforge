import { useState } from "react";
import type { ForgeCandidateDocument, ForgePanelDocument } from "../../server/forge/types";
import { CandidateReview } from "./CandidateReview";
import { ForgeTerminal } from "./ForgeTerminal";

export function ForgeSessionWorkspace({
  sessionId,
  candidate,
  fallback,
  onSessionEnd,
  onPanel,
  onCandidate,
}: {
  sessionId: string;
  candidate: ForgeCandidateDocument | null;
  fallback?: (controls: {
    terminalCollapsed: boolean;
    onTerminalCollapsedChange: (collapsed: boolean) => void;
  }) => React.ReactNode;
  onSessionEnd: (sessionId: string) => void;
  onPanel: (panel: ForgePanelDocument | null) => void;
  onCandidate: (candidate: ForgeCandidateDocument) => void;
}) {
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  const showCandidate = (next: ForgeCandidateDocument) => {
    setTerminalCollapsed(false);
    onCandidate(next);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden max-[900px]:flex-col">
      {(!terminalCollapsed || (!candidate && !fallback)) && (
        <ForgeTerminal
          sessionId={sessionId}
          onSessionEnd={onSessionEnd}
          onPanel={onPanel}
          onCandidate={showCandidate}
        />
      )}
      {candidate ? (
        <CandidateReview
          key={candidate.revision}
          candidate={candidate}
          sessionId={sessionId}
          terminalCollapsed={terminalCollapsed}
          onTerminalCollapsedChange={setTerminalCollapsed}
        />
      ) : (
        fallback?.({ terminalCollapsed, onTerminalCollapsedChange: setTerminalCollapsed })
      )}
    </div>
  );
}
