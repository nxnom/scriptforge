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

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
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
  const Icon = ICONS[tool.icon] ?? Wrench;
  const ready = tool.status === "ready";

  return (
    <article className={`tool-card ${ready ? "" : "planned"}`}>
      <div className="card-top">
        <div className="icon-tile">
          <Icon size={19} />
        </div>
        <span className={`status ${ready ? "ready" : "soon"}`}>
          {ready ? <Check size={11} /> : <Sparkles size={11} />}
          {ready ? "Ready" : "Planned"}
        </span>
      </div>
      <div className="card-copy">
        <h2>{tool.name}</h2>
        <p>{tool.description}</p>
      </div>
      <div className="card-footer">
        <span className="tag">{tool.category}</span>
        <button type="button" disabled={!ready} onClick={() => navigate(`/tools/${tool.id}`)}>
          {ready ? "Open" : "Soon"} <ArrowRight size={12} />
        </button>
      </div>
    </article>
  );
}
