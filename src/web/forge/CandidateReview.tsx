import { Code2, Eye, FileJson, PackageCheck } from "lucide-react";
import { useState } from "react";
import type { ForgeCandidateDocument } from "../../server/forge/types";

type CandidateTab = "preview" | "script" | "manifest";

export function CandidateReview({ candidate }: { candidate: ForgeCandidateDocument }) {
  const [tab, setTab] = useState<CandidateTab>("preview");

  return (
    <aside className="flex min-h-0 w-[min(48%,620px)] min-w-[420px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#343434] bg-[#1d1d1d] max-[900px]:h-[48%] max-[900px]:w-full max-[900px]:min-w-0">
      <header className="flex shrink-0 items-center gap-3 border-[#333] border-b px-4 py-3">
        <PackageCheck size={16} className="text-[#8db995]" />
        <div className="min-w-0">
          <h2 className="m-0 truncate font-medium text-sm">{candidate.name}</h2>
          <p className="mt-0.5 mb-0 truncate text-[10px] text-[#858585]">{candidate.description}</p>
        </div>
        <span className="ml-auto rounded-full bg-[#293229] px-2.5 py-1 text-[10px] text-[#9cc6a2]">
          Ready for review
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-[#333] border-b px-4 py-3 text-[11px] leading-5 text-[#aaa]">
          <p className="m-0 line-clamp-2">{candidate.summary}</p>
          <p className="mt-1 mb-0 text-[10px] text-[#777]">
            {candidate.requiredExecutables.length
              ? `Needs ${candidate.requiredExecutables.map((item) => item.name).join(", ")}`
              : "No extra apps needed · Ask for changes in the terminal"}
          </p>
        </div>
        <nav className="flex shrink-0 gap-1 border-[#333] border-b p-2" aria-label="Candidate files">
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={<Eye size={13} />}>
            Preview
          </TabButton>
          <TabButton active={tab === "script"} onClick={() => setTab("script")} icon={<Code2 size={13} />}>
            Script
          </TabButton>
          <TabButton active={tab === "manifest"} onClick={() => setTab("manifest")} icon={<FileJson size={13} />}>
            Details
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
