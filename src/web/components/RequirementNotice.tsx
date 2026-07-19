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
      title={missing.length === 1 ? "Missing requirement" : `${missing.length} missing requirements`}
      description={
        <div className="grid min-w-0 gap-3 pt-1">
          <p className="m-0 text-[11px] text-[#b9aa92]">
            Install it yourself or let Codex Doctor prepare the commands.
          </p>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {missing.map((requirement) => (
              <code
                className="whitespace-nowrap rounded-md border border-[#5a4324] bg-[#211d17] px-2 py-1 text-[10px] text-[#d8c7aa]"
                key={requirement.name}
              >
                {requirement.name}
                {requirement.version ? ` ${requirement.version}` : ""}
                {requirement.detectedVersion ? ` · found ${requirement.detectedVersion}` : " · not found"}
              </code>
            ))}
          </div>
          <div className="flex justify-end gap-1.5 border-[#443825] border-t pt-2.5">
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
