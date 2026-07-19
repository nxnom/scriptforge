import { Button, LoadingButton } from "@geckoui/geckoui";
import { Pencil, Save, Square } from "lucide-react";

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
        <Button size="sm" variant="outlined" disabled={anotherSessionActive} onClick={start}>
          <Pencil size={13} /> Update
        </Button>
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
          <Save size={13} /> Update tool
        </LoadingButton>
      )}
    </>
  );
}
