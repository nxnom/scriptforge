import { Button, LoadingButton, Tooltip } from "@geckoui/geckoui";
import { Pencil, Save, Square } from "lucide-react";

export function ToolUpdateActions({
  installed,
  sessionActive,
  candidateReady,
  candidateTested,
  candidateSaved,
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
  candidateSaved: boolean;
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
          <Button aria-label="Update tool" className="size-9" size="sm" variant="icon" onClick={start}>
            <Pencil size={14} />
          </Button>
        </Tooltip>
      )}
      {sessionActive && (
        <LoadingButton size="sm" variant="ghost" loading={stopping} onClick={stop}>
          <Square size={12} /> Stop session
        </LoadingButton>
      )}
      {sessionActive && candidateReady && !candidateSaved && (
        <LoadingButton
          size="sm"
          variant="outlined"
          loading={saving}
          disabled={!candidateTested}
          title={candidateTested ? undefined : "Run this candidate successfully in Preview first"}
          onClick={save}
        >
          <Save size={13} /> Save changes
        </LoadingButton>
      )}
    </>
  );
}
