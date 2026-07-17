import {
  ArrowRight,
  AudioWaveform,
  Check,
  Files,
  FileText,
  FileType,
  FolderTree,
  Image,
  ScanSearch,
  Sparkles,
  Table2,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";

const icons: Record<string, ComponentType<{ size?: number }>> = {
  image: Image,
  files: Files,
  table: Table2,
  "file-text": FileText,
  "folder-tree": FolderTree,
  "audio-waveform": AudioWaveform,
  "file-type": FileType,
  "scan-search": ScanSearch,
};

export interface ToolSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  status: string;
}

export function ToolCard({ tool }: { tool: ToolSummary }) {
  const navigate = useNavigate();
  const Icon = icons[tool.icon] ?? Wrench;
  const ready = tool.status === "ready";

  return (
    <article
      className={`flex min-h-44 flex-col gap-3.5 rounded-2xl border border-[#333] bg-[#242424] p-4.5 transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-[#454545] ${ready ? "shadow-[0_4px_16px_-4px_#00000038]" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="grid size-10.5 place-items-center rounded-xl bg-[#2e2e2e] text-white">
          <Icon size={19} />
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full py-1 pr-2.5 pl-2 text-[11px] font-[650] ${ready ? "bg-[#2e2e2e] text-[#c9cdd6]" : "bg-[#3a2e1a] text-[#e0a24e]"}`}
        >
          {ready ? <Check size={11} /> : <Sparkles size={11} />}
          {ready ? "Ready" : "Planned"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <h2 className="m-0 font-[650] font-[Geist_Variable] text-[15px]">{tool.name}</h2>
        <p className="m-0 text-xs text-[#b0b0b0] leading-[1.45]">{tool.description}</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-[#303030] px-2.5 py-1 text-[11px] text-[#b0b0b0]">{tool.category}</span>
        <button
          className="flex items-center gap-1 border-0 bg-transparent text-xs font-[650] text-white disabled:cursor-default disabled:text-[#7a7a7a]"
          type="button"
          disabled={!ready}
          onClick={() => navigate(`/tools/${tool.id}`)}
        >
          {ready ? "Open" : "Soon"} <ArrowRight size={12} />
        </button>
      </div>
    </article>
  );
}
