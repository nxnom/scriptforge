import { toast } from "@geckoui/geckoui";
import { Code2, Eye, FileJson, PackageCheck } from "lucide-react";
import { useState } from "react";
import type { ForgeCandidateDocument } from "../../server/forge/types";
import { useWrite } from "../api";
import { CandidateFeedbackForm } from "./CandidateFeedbackForm";

type CandidateTab = "preview" | "script" | "manifest";

export function CandidateReview({
  sessionId,
  candidate,
  onRequestChanges,
}: {
  sessionId: string;
  candidate: ForgeCandidateDocument;
  onRequestChanges: () => void;
}) {
  const [tab, setTab] = useState<CandidateTab>("preview");
  const [approved, setApproved] = useState(false);
  const sendFeedback = useWrite((api) => api("forge/sessions/:sessionId/feedback").POST());
  const submitFeedback = async ({ intent, note }: { intent: "approve" | "revise"; note: string }) => {
    const text =
      intent === "approve"
        ? `Candidate approved for the next ScriptForge review step.${note.trim() ? `\n\n${note.trim()}` : ""}`
        : `Please revise the candidate and present it again.\n\n${note.trim()}`;
    const response = await sendFeedback.trigger({
      params: { sessionId },
      body: { text, dismiss: intent === "revise" },
    });
    if (!response.data?.ok) throw new Error("Candidate feedback failed.");
    if (intent === "revise") onRequestChanges();
    else {
      setApproved(true);
      toast.success("Candidate approved. Testing will remain a separate explicit step.");
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#343434] bg-[#1d1d1d]">
      <header className="flex shrink-0 items-center gap-3 border-[#333] border-b px-5 py-3.5">
        <PackageCheck size={16} className="text-[#8db995]" />
        <div className="min-w-0">
          <h2 className="m-0 truncate font-medium text-sm">{candidate.name}</h2>
          <p className="mt-0.5 mb-0 truncate text-[10px] text-[#858585]">{candidate.description}</p>
        </div>
        <span className="ml-auto rounded-full bg-[#293229] px-2.5 py-1 text-[10px] text-[#9cc6a2]">
          Ready for review
        </span>
      </header>

      <div className="flex min-h-0 flex-1 max-[900px]:flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-[#333] border-r max-[900px]:border-r-0 max-[900px]:border-b">
          <nav className="flex shrink-0 gap-1 border-[#333] border-b p-2" aria-label="Candidate files">
            <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={<Eye size={13} />}>
              Preview
            </TabButton>
            <TabButton active={tab === "script"} onClick={() => setTab("script")} icon={<Code2 size={13} />}>
              run.mjs
            </TabButton>
            <TabButton active={tab === "manifest"} onClick={() => setTab("manifest")} icon={<FileJson size={13} />}>
              tool.json
            </TabButton>
          </nav>
          <div className="relative min-h-0 flex-1 overflow-hidden bg-[#151515]">
            {tab === "preview" ? (
              <iframe
                title={`${candidate.name} interface preview`}
                className="absolute inset-0 size-full border-0 bg-white"
                sandbox="allow-scripts"
                srcDoc={previewDocument(candidate.interfaceHtml)}
              />
            ) : (
              <pre className="absolute inset-0 m-0 overflow-auto p-4 font-mono text-[11px] leading-5 text-[#d0d0d0]">
                <code>{tab === "script" ? candidate.scriptSource : candidate.manifestSource}</code>
              </pre>
            )}
          </div>
        </div>

        <aside className="flex w-[340px] shrink-0 flex-col overflow-y-auto p-4 max-[900px]:w-full">
          <div className="grid gap-4 text-xs leading-5 text-[#bdbdbd]">
            <section>
              <h3 className="m-0 text-[10px] uppercase tracking-wider text-[#777]">What Codex built</h3>
              <p className="mt-1.5 mb-0 whitespace-pre-wrap">{candidate.summary}</p>
            </section>
            <section>
              <h3 className="m-0 text-[10px] uppercase tracking-wider text-[#777]">Required executables</h3>
              <p className="mt-1.5 mb-0">
                {candidate.requiredExecutables.length
                  ? candidate.requiredExecutables
                      .map((item) => `${item.name}${item.version ? ` ${item.version}` : ""}`)
                      .join(", ")
                  : "None — uses Node.js built-ins"}
              </p>
            </section>
            {candidate.risks?.length ? (
              <section>
                <h3 className="m-0 text-[10px] uppercase tracking-wider text-[#777]">Unresolved risks</h3>
                <ul className="mt-1.5 mb-0 pl-4">
                  {candidate.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
          <div className="mt-auto border-[#333] border-t pt-4">
            <CandidateFeedbackForm approved={approved} onFeedback={submitFeedback} />
          </div>
        </aside>
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
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] ${active ? "bg-[#333] text-white" : "text-[#888] hover:bg-[#292929] hover:text-[#ccc]"}`}
      onClick={onClick}
    >
      {icon} {children}
    </button>
  );
}

function previewDocument(html: string) {
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; media-src data: blob:; font-src data:; form-action 'none'; base-uri 'none'">`;
  return /<head(\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}${policy}`)
    : `${policy}${html}`;
}
