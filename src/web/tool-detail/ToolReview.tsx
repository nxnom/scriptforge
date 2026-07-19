import { Spinner } from "@geckoui/geckoui";
import { Code2, Eye, FileJson } from "lucide-react";
import { useState } from "react";
import { useRead } from "../api";
import { CodeViewer } from "../components/CodeViewer";
import { type Requirement, RequirementNotice } from "../components/RequirementNotice";

type ToolTab = "preview" | "script" | "manifest";

export function ToolReview({
  toolId,
  toolName,
  toolReady,
  listening,
  configurationLoading,
  iframeRef,
  requirements,
  retryRequirements,
  launchDoctor,
}: {
  toolId: string;
  toolName: string;
  toolReady: boolean;
  listening: boolean;
  configurationLoading: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  requirements: Requirement[];
  retryRequirements: () => unknown;
  launchDoctor: () => void;
}) {
  const [tab, setTab] = useState<ToolTab>("preview");
  const source = useRead((api) => api("tools/:toolId/source").GET({ params: { toolId } }), { staleTime: 30_000 });
  const sourceData = source.data?.ok ? source.data : undefined;
  const selectedSource = tab === "script" ? sourceData?.scriptSource : sourceData?.manifestSource;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#343434] bg-[#1d1d1d]">
      <nav className="flex shrink-0 items-center gap-0.5 border-[#333] border-b p-1" aria-label="Tool files">
        <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={<Eye size={12} />}>
          Preview
        </TabButton>
        <TabButton active={tab === "script"} onClick={() => setTab("script")} icon={<Code2 size={12} />}>
          Script
        </TabButton>
        <TabButton active={tab === "manifest"} onClick={() => setTab("manifest")} icon={<FileJson size={12} />}>
          Details
        </TabButton>
      </nav>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#151515]">
        {tab === "preview" ? (
          toolReady ? (
            <iframe
              ref={iframeRef}
              className="absolute inset-0 size-full border-0 bg-[#1a1a1a]"
              src={listening && !configurationLoading ? `/api/tools/${toolId}/ui` : undefined}
              title={`${toolName} interface`}
              sandbox="allow-scripts allow-downloads"
            />
          ) : (
            <div className="grid size-full place-items-center px-4 pb-[8vh]">
              <div className="w-full max-w-2xl">
                <RequirementNotice requirements={requirements} retry={retryRequirements} launchDoctor={launchDoctor} />
              </div>
            </div>
          )
        ) : source.loading ? (
          <div className="grid size-full place-items-center text-[#888]">
            <span className="inline-flex items-center gap-2 text-xs">
              <Spinner /> Loading source…
            </span>
          </div>
        ) : (
          <CodeViewer
            source={selectedSource ?? "Source is unavailable."}
            language={tab === "script" ? "javascript" : "json"}
            filename={tab === "script" ? "run.mjs" : "tool.json"}
          />
        )}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: React.PropsWithChildren<{ active: boolean; onClick: () => void; icon: React.ReactNode }>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] leading-4 ${
        active ? "bg-[#333] text-white" : "text-[#888] hover:bg-[#292929] hover:text-[#ccc]"
      }`}
      onClick={onClick}
    >
      {icon} {children}
    </button>
  );
}
