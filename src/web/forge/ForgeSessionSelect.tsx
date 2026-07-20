import { Button, Label, LoadingButton, RHFError, RHFSelect, SelectOption, toast } from "@geckoui/geckoui";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useRead, useWrite } from "../api";
import { forgeError } from "./forgeError";

export function ForgeSessionSelect({ disabled }: { disabled: boolean }) {
  const drafts = useRead((api) => api("forge/sessions").GET(), { staleTime: 0 });
  const discard = useWrite((api) => api("forge/sessions/:sessionId/draft").DELETE());
  const form = useFormContext<{ resumeSessionId?: string }>();
  const sessions = drafts.data?.sessions ?? [];
  const [pendingDelete, setPendingDelete] = useState<(typeof sessions)[number]>();
  const deleteSession = async () => {
    if (!pendingDelete) return;
    const response = await discard.trigger({
      params: { sessionId: pendingDelete.sessionId },
      optimistic: (cache) =>
        cache("forge/sessions").set((current) => ({
          ...current,
          sessions: current.sessions.filter((session) => session.sessionId !== pendingDelete.sessionId),
        })),
    });
    if (!response.data?.ok) return toast.error(forgeError(response.error));
    if (form.getValues("resumeSessionId") === pendingDelete.sessionId) {
      form.setValue("resumeSessionId", "", { shouldDirty: true });
    }
    toast.success(`${pendingDelete.name} was deleted.`);
    setPendingDelete(undefined);
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
                    setPendingDelete(session);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    closeMenu();
                    setPendingDelete(session);
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
      {pendingDelete && (
        <div className="mt-1 flex items-center gap-3 rounded-lg border border-[#603737] bg-[#302020] p-2.5 text-left">
          <p className="m-0 min-w-0 flex-1 text-[11px] leading-4 text-[#d8b0b0]">
            Delete <strong className="text-[#ffd1d1]">{pendingDelete.name}</strong>? Its temporary files and saved
            session will be permanently removed.
          </p>
          <div className="flex shrink-0 gap-1.5">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={discard.loading}
              onClick={() => setPendingDelete(undefined)}
            >
              Keep
            </Button>
            <LoadingButton type="button" size="xs" loading={discard.loading} onClick={deleteSession}>
              Delete session
            </LoadingButton>
          </div>
        </div>
      )}
    </div>
  );
}
