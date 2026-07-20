import { Button, Spinner, Tooltip } from "@geckoui/geckoui";
import { Code2, Eye, FileJson, RotateCw } from "lucide-react";
import { useState } from "react";
import { toolIframeAllow, toolIframeSandbox } from "../../shared/tool-iframe-policy";
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
  const [previewKey, setPreviewKey] = useState(0);
  const source = useRead((api) => api("tools/:toolId/source").GET({ params: { toolId } }), { staleTime: 30_000 });
  const sourceData = source.data?.ok ? source.data : undefined;
  const selectedSource = tab === "script" ? sourceData?.scriptSource : sourceData?.manifestSource;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <nav className="flex h-10 shrink-0 items-center border-[#333] border-b px-1" aria-label="Tool files">
        <div className="flex h-full min-w-0 flex-1 items-stretch gap-6">
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={<Eye size={14} />}>
            Preview
          </TabButton>
          <TabButton active={tab === "script"} onClick={() => setTab("script")} icon={<Code2 size={14} />}>
            Script
          </TabButton>
          <TabButton active={tab === "manifest"} onClick={() => setTab("manifest")} icon={<FileJson size={14} />}>
            Details
          </TabButton>
        </div>
        {tab === "preview" && toolReady && (
          <Tooltip content="Reload preview" triggerAsChild>
            <Button
              aria-label="Reload preview"
              variant="icon"
              size="xs"
              disabled={!listening || configurationLoading}
              onClick={() => setPreviewKey((current) => current + 1)}
            >
              <RotateCw size={13} />
            </Button>
          </Tooltip>
        )}
      </nav>
      <div className="relative mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#333] bg-[#151515]">
        {toolReady && (
          <iframe
            key={previewKey}
            ref={iframeRef}
            className={`absolute inset-0 size-full border-0 bg-[#1a1a1a] ${tab === "preview" ? "block" : "hidden"}`}
            src={listening && !configurationLoading ? `/api/tools/${toolId}/ui` : undefined}
            title={`${toolName} interface`}
            allow={toolIframeAllow}
            sandbox={toolIframeSandbox}
          />
        )}
        {tab === "preview" && !toolReady && (
          <div className="grid size-full place-items-center px-4 pb-[8vh]">
            <div className="w-full max-w-2xl">
              <RequirementNotice requirements={requirements} retry={retryRequirements} launchDoctor={launchDoctor} />
            </div>
          </div>
        )}
        {tab !== "preview" &&
          (source.loading ? (
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
          ))}
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
      className={`relative inline-flex items-center gap-1.5 border-0 bg-transparent px-1 text-[11px] ${
        active
          ? "text-white after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-0.5 after:rounded-full after:bg-[#5468ff]"
          : "text-[#888] hover:text-[#ccc]"
      }`}
      onClick={onClick}
    >
      {icon} {children}
    </button>
  );
}
