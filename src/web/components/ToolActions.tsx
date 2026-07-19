import { Button, ConfirmDialog, toast } from "@geckoui/geckoui";
import { Download, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { invalidate, useWrite } from "../api";

export function ToolActions({ toolId, toolName }: { toolId: string; toolName: string }) {
  const navigate = useNavigate();
  const deleteTool = useWrite((api) => api("tools/:toolId").DELETE());
  const confirmDelete = () => {
    ConfirmDialog.show({
      title: `Delete ${toolName}?`,
      content: "This removes the tool and its local files from ScriptForge. Export it first if you may need it later.",
      confirmButtonLabel: "Delete tool",
      cancelButtonLabel: "Cancel",
      dismissOnOutsideClick: false,
      onConfirm: async ({ preventDefault, dismiss }) => {
        preventDefault();
        const response = await deleteTool.trigger({ params: { toolId } });
        if (!response.data?.ok) return toast.error(apiError(response.error));
        invalidate("tools");
        dismiss();
        toast.success(`${toolName} deleted.`);
        navigate("/");
      },
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="outlined" onClick={() => window.location.assign(`/api/tools/${toolId}/export`)}>
        <Download size={13} /> Export
      </Button>
      <Button className="text-[#d98279]" size="sm" variant="ghost" onClick={confirmDelete}>
        <Trash2 size={13} /> Delete
      </Button>
    </div>
  );
}

function apiError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The tool could not be deleted.";
}
