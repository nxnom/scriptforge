import { Alert, Button } from "@geckoui/geckoui";
import { Bot, RefreshCw } from "lucide-react";

type Requirement = {
  name: string;
  version?: string;
  detectedVersion: string | null;
  reason: "available" | "missing" | "version_mismatch" | "version_unknown";
};

export function RequirementNotice({
  requirements,
  retry,
  launchDoctor,
}: {
  requirements: Requirement[];
  retry: () => unknown;
  launchDoctor: () => void;
}) {
  const missing = requirements.filter((requirement) => requirement.reason !== "available");
  if (!missing.length) return null;

  return (
    <Alert
      variant="warning"
      condensed
      title="Missing requirement"
      description={
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          <span className="text-[11px] text-[#b9aa92]">
            Install it yourself or let Codex Doctor prepare the commands.
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {missing.map((requirement) => (
              <code
                className="rounded-md border border-[#5a4324] bg-[#211d17] px-2 py-1 text-[10px] text-[#d8c7aa]"
                key={requirement.name}
              >
                {requirement.name}
                {requirement.version ? ` ${requirement.version}` : ""}
                {requirement.detectedVersion ? ` · ${requirement.detectedVersion}` : " · not found"}
              </code>
            ))}
          </div>
          <div className="ml-auto flex shrink-0 gap-1.5">
            <Button type="button" size="xs" variant="ghost" onClick={retry}>
              <RefreshCw size={12} /> Retry
            </Button>
            <Button type="button" size="xs" variant="outlined" onClick={launchDoctor}>
              <Bot size={12} /> Open Doctor
            </Button>
          </div>
        </div>
      }
    />
  );
}
