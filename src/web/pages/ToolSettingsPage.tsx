import { Button } from "@geckoui/geckoui";
import { ArrowLeft, Settings2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useRead } from "../api";
import { InstalledConfigurationPanel } from "../configuration/ToolConfigurationDialog";

export function ToolSettingsPage() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const tools = useRead((api) => api("tools").GET(), { staleTime: 30_000 });
  const tool = tools.data?.tools.find((candidate) => candidate.id === toolId);
  if (!toolId) return null;
  const back = () => navigate(`/tools/${toolId}`);

  return (
    <section className="mx-auto flex w-full max-w-170 flex-col gap-4">
      <header className="flex items-center gap-3 border-[#333] border-b pb-3">
        <Button aria-label="Back to tool" variant="icon" size="sm" onClick={back}>
          <ArrowLeft size={14} />
        </Button>
        <span className="grid size-9 place-items-center rounded-xl bg-[#2e2e2e]">
          <Settings2 size={16} />
        </span>
        <div>
          <h1 className="m-0 font-[Geist_Variable] text-lg">{tool?.name ?? "Tool"} configuration</h1>
          <p className="mt-0.5 mb-0 text-[11px] text-[#929292]">
            Private values are encrypted locally and excluded from exports.
          </p>
        </div>
      </header>
      <div className="rounded-2xl border border-[#333] bg-[#1d1d1d] p-5">
        <InstalledConfigurationPanel toolId={toolId} onSaved={back} onCancel={back} showHeading={false} />
      </div>
    </section>
  );
}
