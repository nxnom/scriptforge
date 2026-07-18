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
    <div className="grid gap-3 rounded-xl border border-[#5a4324] bg-[#2c251b] p-3">
      <Alert
        variant="warning"
        condensed
        title="This tool needs another app before it can run"
        description="You can install the requirements yourself and retry, or explicitly launch Codex Doctor for help. The Doctor never starts automatically."
      />
      <ul className="m-0 grid gap-1 pl-5 text-[11px] text-[#d2c4ad]">
        {missing.map((requirement) => (
          <li key={requirement.name}>
            <code>{requirement.name}</code>
            {requirement.version ? ` ${requirement.version}` : ""}
            {requirement.detectedVersion ? ` · found ${requirement.detectedVersion}` : " · not found"}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="xs" variant="ghost" onClick={retry}>
          <RefreshCw size={12} /> Retry check
        </Button>
        <Button type="button" size="xs" variant="outlined" onClick={launchDoctor}>
          <Bot size={12} /> Launch Codex Doctor
        </Button>
      </div>
    </div>
  );
}
