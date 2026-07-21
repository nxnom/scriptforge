import type { ForgeCandidateDocument, ForgePanelDocument } from "../../server/forge/types";
import { ForgeSessionWorkspace } from "../forge/ForgeSessionWorkspace";
import { ForgeSidePanel } from "../forge/ForgeSidePanel";

export function ToolUpdateWorkspace({
  sessionId,
  panel,
  candidate,
  installedReview,
  onSessionEnd,
  onPanel,
  onCandidate,
}: {
  sessionId: string;
  panel: ForgePanelDocument | null;
  candidate: ForgeCandidateDocument | null;
  installedReview: React.ReactNode;
  onSessionEnd: (sessionId: string) => void;
  onPanel: (panel: ForgePanelDocument | null) => void;
  onCandidate: (candidate: ForgeCandidateDocument) => void;
}) {
  if (panel) {
    return (
      <ForgeSidePanel
        sessionId={sessionId}
        panel={panel}
        onResolved={() => onPanel(null)}
        onSubmissionError={() => onPanel(panel)}
      />
    );
  }

  return (
    <ForgeSessionWorkspace
      sessionId={sessionId}
      candidate={candidate}
      onSessionEnd={onSessionEnd}
      onPanel={onPanel}
      onCandidate={onCandidate}
      fallback={
        <aside className="flex min-h-0 w-[min(48%,620px)] min-w-[420px] shrink-0 overflow-hidden max-[900px]:h-[48%] max-[900px]:w-full max-[900px]:min-w-0">
          {installedReview}
        </aside>
      }
    />
  );
}
