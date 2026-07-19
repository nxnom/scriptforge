import { Button, ConfirmDialog, Menu, MenuItem, MenuTrigger, Tooltip, toast } from "@geckoui/geckoui";
import { Download, Ellipsis, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { invalidate, useWrite } from "../api";

export function ToolActions({
  toolId,
  toolName,
  mode = "icons",
}: {
  toolId: string;
  toolName: string;
  mode?: "icons" | "menu";
}) {
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
  const exportTool = () => window.location.assign(`/api/tools/${toolId}/export`);

  if (mode === "menu") {
    return (
      <fieldset aria-label={`${toolName} actions`} className="pointer-events-auto relative z-10 m-0 border-0 p-0">
        <Menu placement="bottom-end">
          <MenuTrigger>
            {({ toggleMenu }) => (
              <Tooltip content="Tool actions" triggerAsChild>
                <Button aria-label={`Actions for ${toolName}`} size="xs" variant="icon" onClick={toggleMenu}>
                  <Ellipsis size={15} />
                </Button>
              </Tooltip>
            )}
          </MenuTrigger>
          <MenuItem onClick={exportTool}>
            <span className="flex items-center gap-2">
              <Download size={13} /> Export
            </span>
          </MenuItem>
          <MenuItem onClick={confirmDelete}>
            <span className="flex items-center gap-2 text-[#d98279]">
              <Trash2 size={13} /> Delete
            </span>
          </MenuItem>
        </Menu>
      </fieldset>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip content="Export tool" triggerAsChild>
        <Button aria-label="Export tool" size="sm" variant="icon" onClick={exportTool}>
          <Download size={14} />
        </Button>
      </Tooltip>
      <Tooltip content="Delete tool" triggerAsChild>
        <Button aria-label="Delete tool" className="text-[#d98279]" size="sm" variant="icon" onClick={confirmDelete}>
          <Trash2 size={14} />
        </Button>
      </Tooltip>
    </div>
  );
}

function apiError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The tool could not be deleted.";
}
