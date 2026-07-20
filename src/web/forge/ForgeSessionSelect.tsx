import { ConfirmDialog, Label, RHFError, RHFSelect, SelectOption, toast } from "@geckoui/geckoui";
import { Trash2 } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { invalidate, useRead, useWrite } from "../api";
import { forgeError } from "./forgeError";

export function ForgeSessionSelect({ disabled }: { disabled: boolean }) {
  const drafts = useRead((api) => api("forge/sessions").GET(), { staleTime: 0 });
  const discard = useWrite((api) => api("forge/sessions/:sessionId/draft").DELETE());
  const form = useFormContext<{ resumeSessionId?: string }>();
  const sessions = drafts.data?.sessions ?? [];
  const confirmDiscard = (session: (typeof sessions)[number]) => {
    ConfirmDialog.show({
      title: `Delete ${session.name}?`,
      content: "This permanently removes its staged files and saved Codex session link.",
      confirmButtonLabel: "Delete session",
      cancelButtonLabel: "Keep session",
      dismissOnOutsideClick: false,
      onConfirm: async ({ preventDefault, dismiss }) => {
        preventDefault();
        const response = await discard.trigger({ params: { sessionId: session.sessionId } });
        if (!response.data?.ok) return toast.error(forgeError(response.error));
        if (form.getValues("resumeSessionId") === session.sessionId) {
          form.setValue("resumeSessionId", "", { shouldDirty: true });
        }
        invalidate("forge/sessions");
        toast.success(`${session.name} was deleted.`);
        dismiss();
      },
    });
  };
  return (
    <div className="grid gap-1.5">
      <Label>Saved session</Label>
      <RHFSelect
        name="resumeSessionId"
        placeholder="Start a fresh session"
        clearable
        filterable="dropdown"
        disabled={disabled || drafts.loading || sessions.length === 0}
        menuClassName="max-h-72"
      >
        {sessions.map((session) => (
          <SelectOption
            key={session.sessionId}
            value={session.sessionId}
            label={`${session.name} · ${session.status === "interrupted" ? "Interrupted" : "Stopped"}`}
            onClick={({ preventDefault }) => {
              if (!session.resumable) preventDefault();
            }}
          >
            {({ closeMenu }) => (
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className={`min-w-0 flex-1 truncate ${session.resumable ? "" : "text-[#777]"}`}>
                  {session.name} · {session.status === "interrupted" ? "Interrupted" : "Stopped"}
                  {session.resumable ? "" : " · Unavailable"}
                </span>
                {/* The option is already a button, so a nested button would be invalid HTML. */}
                {/* biome-ignore lint/a11y/useSemanticElements: keyboard-enabled nested control inside the option button */}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Delete ${session.name}`}
                  title={`Delete ${session.name}`}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] text-[#8f8f8f] hover:bg-[#4a2929] hover:text-[#ffaaaa]"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeMenu();
                    confirmDiscard(session);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    closeMenu();
                    confirmDiscard(session);
                  }}
                >
                  <Trash2 size={12} /> Delete
                </span>
              </span>
            )}
          </SelectOption>
        ))}
      </RHFSelect>
      <p className="m-0 text-[10px] leading-4 text-[#858585]">
        {sessions.length
          ? "Choose a saved session to continue it, or leave this empty to start fresh."
          : drafts.loading
            ? "Checking for saved sessions…"
            : "No saved sessions found. A fresh session will start."}
      </p>
      <RHFError name="resumeSessionId" />
    </div>
  );
}
