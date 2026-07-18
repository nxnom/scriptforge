import { toast } from "@geckoui/geckoui";
import { MessageSquareText } from "lucide-react";
import type { ForgePanelDocument } from "../../server/forge/types";
import { useWrite } from "../api";
import { PanelBlockRenderer } from "./PanelBlockRenderer";
import { PanelFeedbackForm } from "./PanelFeedbackForm";

export function ForgeSidePanel({
  sessionId,
  panel,
  onResolved,
  onSubmissionError,
}: {
  sessionId: string;
  panel: ForgePanelDocument;
  onResolved: () => void;
  onSubmissionError: () => void;
}) {
  const sendFeedback = useWrite((api) => api("forge/sessions/:sessionId/feedback").POST());
  const submitFeedback = async (text: string) => {
    const pending = sendFeedback.trigger({ params: { sessionId }, body: { text, dismiss: true } });
    onResolved();
    const response = await pending;
    if (!response.data?.ok) {
      onSubmissionError();
      toast.error("Feedback could not be sent to Codex.");
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#343434] bg-[#1d1d1d]">
      <header className="flex shrink-0 items-center gap-2 border-[#333] border-b px-5 py-3.5">
        <MessageSquareText className="shrink-0 text-[#999]" size={15} />
        <span className="truncate font-medium text-[#ddd] text-sm">{panel.title}</span>
        <span className="ml-auto text-[10px] text-[#777]">Codex is waiting for your response</span>
      </header>
      <PanelFeedbackForm key={panel.version} panel={panel} onFeedback={submitFeedback}>
        <div className="grid gap-4">
          {panel.blocks.map((block) => (
            <PanelBlockRenderer block={block} key={block.id} />
          ))}
        </div>
      </PanelFeedbackForm>
    </section>
  );
}
