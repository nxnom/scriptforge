import { Button, Dialog } from "@geckoui/geckoui";
import { ArrowRight, Plus } from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { invalidate, useRead, useWrite } from "../api";
import { ForgePreflightDialog } from "../forge/ForgePreflightDialog";
import { forgeError } from "../forge/forgeError";

export function ForgeLaunchButton({
  idleLabel = "Forge a tool",
  activeLabel = "Go to Forge",
  className = "",
}: {
  idleLabel?: string;
  activeLabel?: string;
  className?: string;
} = {}) {
  const navigate = useNavigate();
  const activeSession = useRead((api) => api("forge/sessions/active").GET(), { staleTime: 1_000 });
  const startForge = useWrite((api) => api("forge/sessions").POST());
  const resumeForge = useWrite((api) => api("forge/sessions/:sessionId/resume").POST());

  const openDialog = useCallback(() => {
    Dialog.show({
      className: "w-[min(620px,calc(100vw-24px))] max-w-none overflow-visible border border-[#393939] bg-[#242424] p-5",
      content: ({ dismiss }) => (
        <ForgePreflightDialog
          dismiss={dismiss}
          onContinue={async (preferences, resumeSessionId) => {
            const response = resumeSessionId
              ? await resumeForge.trigger({ params: { sessionId: resumeSessionId }, body: preferences })
              : await startForge.trigger({ body: preferences });
            const data = response.data;
            if (!data?.ok) throw new Error(forgeError(response.error));
            invalidate("forge/sessions/active");
            dismiss();
            window.setTimeout(() => navigate("/forge", { state: { launchedSessionId: data.sessionId } }), 300);
          }}
        />
      ),
    });
  }, [navigate, resumeForge.trigger, startForge.trigger]);

  return (
    <Button
      className={`shrink-0 gap-2 rounded-[10px] ${className}`}
      size="sm"
      onClick={() => (activeSession.data?.sessionId ? navigate("/forge") : openDialog())}
    >
      {activeSession.data?.sessionId ? <ArrowRight size={16} /> : <Plus size={16} />}
      <span className="max-[480px]:hidden">{activeSession.data?.sessionId ? activeLabel : idleLabel}</span>
    </Button>
  );
}
