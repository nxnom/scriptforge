import { Button, Tooltip } from "@geckoui/geckoui";
import { form as spooshForm } from "@spoosh/core";
import { Code2, Eye, FileJson, Settings2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ForgeCandidateDocument } from "../../server/forge/types";
import { toolDocumentPolicy, toolIframeAllow, toolIframeSandbox } from "../../shared/tool-iframe-policy";
import { useRead, useWrite } from "../api";
import { CodeViewer } from "../components/CodeViewer";
import { openCandidateConfiguration } from "../configuration/ToolConfigurationDialog";
import { normalizeToolFile, type ToolRunMessage, useToolHostBridge } from "../tool-host/useToolHostBridge";

type CandidateTab = "preview" | "script" | "manifest";

export function CandidateReview({
  candidate,
  sessionId,
  onTestStatusChange,
}: {
  candidate: ForgeCandidateDocument;
  sessionId: string;
  onTestStatusChange: (ready: boolean) => void;
}) {
  const [tab, setTab] = useState<CandidateTab>("preview");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const startCandidate = useWrite((api) => api("forge/sessions/:sessionId/candidate/jobs").POST());
  const configuration = useRead(
    (api) =>
      api("forge/sessions/:sessionId/candidate/configuration").GET({
        params: { sessionId },
        query: { revision: candidate.revision },
      }),
    { staleTime: 0 },
  );
  const configurationRef = useRef(configuration);
  configurationRef.current = configuration;
  const runCandidate = useCallback(
    async (message: ToolRunMessage) => {
      if (configurationRef.current.data?.ok && !configurationRef.current.data.ready) {
        const saved = await openCandidateConfiguration(sessionId, candidate.revision);
        if (!saved) throw new Error("Add the required configuration to test this tool.");
        await configurationRef.current.trigger();
      }
      const response = await startCandidate.trigger({
        params: { sessionId },
        body: spooshForm({
          revision: candidate.revision,
          input: JSON.stringify(message.input),
          files: message.files.map(normalizeToolFile),
        }),
      });
      if (!response.data?.ok) throw new Error(candidateError(response.error));
      return { jobId: response.data.jobId };
    },
    [candidate.revision, sessionId, startCandidate.trigger],
  );
  const bridge = useToolHostBridge({ iframeRef, startJob: runCandidate });
  useEffect(() => onTestStatusChange(bridge.jobStatus === "succeeded"), [bridge.jobStatus, onTestStatusChange]);

  return (
    <aside className="flex min-h-0 w-[min(48%,620px)] min-w-[420px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#343434] bg-[#1d1d1d] max-[900px]:h-[48%] max-[900px]:w-full max-[900px]:min-w-0">
      <div className="flex min-h-0 flex-1 flex-col">
        <nav className="flex shrink-0 items-center gap-0.5 border-[#333] border-b p-1" aria-label="Candidate files">
          <div className="flex min-w-0 flex-1 gap-0.5">
            <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={<Eye size={12} />}>
              Preview
            </TabButton>
            <TabButton active={tab === "script"} onClick={() => setTab("script")} icon={<Code2 size={12} />}>
              Script
            </TabButton>
            <TabButton active={tab === "manifest"} onClick={() => setTab("manifest")} icon={<FileJson size={12} />}>
              Details
            </TabButton>
          </div>
          {configuration.data?.ok && configuration.data.fields.length > 0 && (
            <Tooltip content="Tool configuration" triggerAsChild>
              <Button
                aria-label="Tool configuration"
                variant="icon"
                size="xs"
                onClick={() => void openCandidateConfiguration(sessionId, candidate.revision)}
              >
                <Settings2 size={12} />
              </Button>
            </Tooltip>
          )}
        </nav>
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#151515]">
          <iframe
            ref={iframeRef}
            title={`${candidate.name} interface preview`}
            className={`absolute inset-0 size-full border-0 bg-white ${tab === "preview" ? "block" : "hidden"}`}
            allow={toolIframeAllow}
            sandbox={toolIframeSandbox}
            srcDoc={bridge.listening && !configuration.loading ? previewDocument(candidate.interfaceHtml) : undefined}
          />
          {tab !== "preview" && (
            <CodeViewer
              source={tab === "script" ? candidate.scriptSource : candidate.manifestSource}
              language={tab === "script" ? "javascript" : "json"}
              filename={tab === "script" ? "run.mjs" : "tool.json"}
            />
          )}
        </div>
        {candidate.risks?.length ? (
          <details className="shrink-0 border-[#333] border-t px-4 py-2 text-[10px] text-[#888]">
            <summary className="cursor-pointer">{candidate.risks.length} note(s) to review</summary>
            <ul className="mb-1 pl-4 leading-4">
              {candidate.risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {bridge.hostError && (
          <p className="m-0 shrink-0 border-[#543733] border-t bg-[#2a1d1c] px-4 py-2 text-[10px] text-[#e19a91]">
            {bridge.hostError}
          </p>
        )}
        <details className="shrink-0 border-[#333] border-t px-4 py-2 text-[10px] text-[#888]">
          <summary className="cursor-pointer">Host bridge log · {bridge.diagnostics.length} events</summary>
          <ol className="mb-1 max-h-28 overflow-auto pl-4 font-mono leading-4">
            {bridge.diagnostics.map((entry) => (
              <li key={entry.id}>{entry.message}</li>
            ))}
          </ol>
        </details>
      </div>
    </aside>
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
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] leading-4 ${active ? "bg-[#333] text-white" : "text-[#888] hover:bg-[#292929] hover:text-[#ccc]"}`}
      onClick={onClick}
    >
      {icon} {children}
    </button>
  );
}

function previewDocument(html: string) {
  const policy = `<meta http-equiv="Content-Security-Policy" content="${toolDocumentPolicy}">`;
  return /<head(\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}${policy}`)
    : `${policy}${html}`;
}

function candidateError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "The candidate could not start.";
}
