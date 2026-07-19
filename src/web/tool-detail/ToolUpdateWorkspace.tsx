import type { ForgeCandidateDocument, ForgePanelDocument } from "../../server/forge/types";
import { CandidateReview } from "../forge/CandidateReview";
import { ForgeSidePanel } from "../forge/ForgeSidePanel";
import { ForgeTerminal } from "../forge/ForgeTerminal";

export function ToolUpdateWorkspace({
  sessionId,
  panel,
  candidate,
  installedReview,
  onSessionEnd,
  onPanel,
  onCandidate,
  onTestStatusChange,
}: {
  sessionId: string;
  panel: ForgePanelDocument | null;
  candidate: ForgeCandidateDocument | null;
  installedReview: React.ReactNode;
  onSessionEnd: (sessionId: string) => void;
  onPanel: (panel: ForgePanelDocument | null) => void;
  onCandidate: (candidate: ForgeCandidateDocument) => void;
  onTestStatusChange: (tested: boolean) => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden max-[900px]:flex-col">
      <ForgeTerminal sessionId={sessionId} onSessionEnd={onSessionEnd} onPanel={onPanel} onCandidate={onCandidate} />
      {panel ? (
        <ForgeSidePanel
          sessionId={sessionId}
          panel={panel}
          onResolved={() => onPanel(null)}
          onSubmissionError={() => onPanel(panel)}
        />
      ) : candidate ? (
        <CandidateReview
          key={candidate.revision}
          candidate={candidate}
          sessionId={sessionId}
          onTestStatusChange={onTestStatusChange}
        />
      ) : (
        <aside className="flex min-h-0 w-[min(48%,620px)] min-w-[420px] shrink-0 overflow-hidden max-[900px]:h-[48%] max-[900px]:w-full max-[900px]:min-w-0">
          {installedReview}
        </aside>
      )}
    </div>
  );
}
