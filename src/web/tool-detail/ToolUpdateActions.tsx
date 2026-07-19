import { Button, LoadingButton, Tooltip } from "@geckoui/geckoui";
import { Pencil, Square } from "lucide-react";

export function ToolUpdateActions({
  installed,
  sessionActive,
  candidateReady,
  candidateTested,
  anotherSessionActive,
  stopping,
  saving,
  start,
  stop,
  save,
}: {
  installed: boolean;
  sessionActive: boolean;
  candidateReady: boolean;
  candidateTested: boolean;
  anotherSessionActive: boolean;
  stopping: boolean;
  saving: boolean;
  start: () => void;
  stop: () => void;
  save: () => void;
}) {
  return (
    <>
      {installed && !sessionActive && (
        <Tooltip content="Update tool" triggerAsChild>
          <Button
            aria-label="Update tool"
            className="size-9"
            size="sm"
            variant="icon"
            disabled={anotherSessionActive}
            onClick={start}
          >
            <Pencil size={14} />
          </Button>
        </Tooltip>
      )}
      {sessionActive && (
        <LoadingButton size="sm" variant="ghost" loading={stopping} onClick={stop}>
          <Square size={12} /> Stop session
        </LoadingButton>
      )}
      {sessionActive && candidateReady && (
        <LoadingButton
          size="sm"
          variant="outlined"
          loading={saving}
          disabled={!candidateTested}
          title={candidateTested ? undefined : "Run this candidate successfully in Preview first"}
          onClick={save}
        >
          <Pencil size={13} /> Update tool
        </LoadingButton>
      )}
    </>
  );
}
