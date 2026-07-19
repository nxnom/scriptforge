import { Button, Dialog } from "@geckoui/geckoui";
import { ArrowRight, Plus } from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRead, useWrite } from "../api";
import { ForgePreflightDialog } from "../forge/ForgePreflightDialog";

export function ForgeLaunchButton() {
  const navigate = useNavigate();
  const activeSession = useRead((api) => api("forge/sessions/active").GET(), { staleTime: 1_000 });
  const startForge = useWrite((api) => api("forge/sessions").POST());

  const openDialog = useCallback(() => {
    Dialog.show({
      className: "w-[min(620px,calc(100vw-24px))] max-w-none border border-[#393939] bg-[#242424] p-5",
      content: ({ dismiss }) => (
        <ForgePreflightDialog
          dismiss={dismiss}
          onContinue={async (preferences) => {
            const response = await startForge.trigger({ body: preferences });
            if (!response.data?.ok) throw new Error(forgeError(response.error));
            navigate("/forge");
          }}
        />
      ),
    });
  }, [navigate, startForge.trigger]);

  return (
    <Button
      className="shrink-0 gap-2 rounded-[10px]"
      size="sm"
      onClick={() => (activeSession.data?.sessionId ? navigate("/forge") : openDialog())}
    >
      {activeSession.data?.sessionId ? <ArrowRight size={16} /> : <Plus size={16} />}
      <span className="max-[480px]:hidden">{activeSession.data?.sessionId ? "Go to Forge" : "Forge a tool"}</span>
    </Button>
  );
}

function forgeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The local Codex terminal could not start.";
}
