import {
  AudioWaveform,
  Box,
  Check,
  Download,
  Files,
  FileText,
  FileType,
  FolderTree,
  Image,
  KeyRound,
  ScanSearch,
  Sparkles,
  Table2,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { ToolActions } from "./ToolActions";

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
  origin?: "bundled" | "installed";
  createdAt?: number;
}

export function ToolCard({ tool, layout = "grid" }: { tool: ToolSummary; layout?: "grid" | "list" }) {
  const Icon = icons[tool.icon] ?? Wrench;
  const available = ["ready", "needs-install", "needs-config"].includes(tool.status);
  const className = `relative h-full border border-[#333] bg-[#242424] transition-colors duration-150 ${available ? "hover:border-[#4a4a4a]" : ""} ${tool.status === "ready" ? "shadow-[0_4px_16px_-4px_#00000038]" : ""}`;

  return (
    <article className={`${className} ${layout === "grid" ? "min-h-44 rounded-[18px]" : "min-h-24 rounded-xl"}`}>
      {available && (
        <Link
          aria-label={`Open ${tool.name}`}
          className="absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-[#777]"
          to={`/tools/${tool.id}`}
        />
      )}
      {layout === "grid" ? <GridCardContent tool={tool} Icon={Icon} /> : <ListCardContent tool={tool} Icon={Icon} />}
    </article>
  );
}

function GridCardContent({ tool, Icon }: { tool: ToolSummary; Icon: ComponentType<{ size?: number }> }) {
  return (
    <div className="pointer-events-none relative flex h-full min-h-44 flex-col gap-3 p-4.5">
      <div className="flex items-center justify-between">
        <ToolIcon Icon={Icon} />
        <StatusBadge status={tool.status} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <ToolCopy tool={tool} />
      </div>
      <CardFooter tool={tool} />
    </div>
  );
}

function ListCardContent({ tool, Icon }: { tool: ToolSummary; Icon: ComponentType<{ size?: number }> }) {
  return (
    <div className="pointer-events-none relative grid min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 max-[620px]:grid-cols-[auto_minmax(0,1fr)]">
      <ToolIcon Icon={Icon} />
      <div className="min-w-0">
        <ToolCopy tool={tool} />
      </div>
      <div className="flex items-center gap-3 max-[620px]:col-span-2 max-[620px]:justify-end">
        <span className="rounded-full bg-[#303030] px-2.5 py-1 text-[10px] text-[#b0b0b0]">{tool.category}</span>
        {tool.origin === "bundled" && <BuiltinBadge />}
        <StatusBadge status={tool.status} />
        {tool.origin === "installed" && (
          <span className="pointer-events-auto relative z-10">
            <ToolActions mode="menu" toolId={tool.id} toolName={tool.name} />
          </span>
        )}
      </div>
    </div>
  );
}

function ToolIcon({ Icon }: { Icon: ComponentType<{ size?: number }> }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#2e2e2e] text-white">
      <Icon size={18} />
    </span>
  );
}

function ToolCopy({ tool }: { tool: ToolSummary }) {
  return (
    <>
      <h2 className="m-0 truncate font-[650] font-[Geist_Variable] text-[15px]">{tool.name}</h2>
      <p className="m-0 line-clamp-2 text-xs text-[#b0b0b0] leading-[1.45]">{tool.description}</p>
    </>
  );
}

function CardFooter({ tool }: { tool: ToolSummary }) {
  return (
    <div className="flex items-center justify-between">
      <span className="rounded-full bg-[#303030] px-2.5 py-1 text-[10px] text-[#b0b0b0]">{tool.category}</span>
      {tool.origin === "bundled" && <BuiltinBadge />}
      {tool.origin === "installed" && <ToolActions mode="menu" toolId={tool.id} toolName={tool.name} />}
    </div>
  );
}

function BuiltinBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#3b3b3b] px-2 py-1 text-[10px] text-[#929292]">
      <Box size={10} /> Built-in
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ready = status === "ready";
  const needsInstall = status === "needs-install";
  const needsConfig = status === "needs-config";
  const Icon = ready ? Check : needsInstall ? Download : needsConfig ? KeyRound : Sparkles;
  const label = ready ? "Ready" : needsInstall ? "Needs install" : needsConfig ? "Setup required" : "Unavailable";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full py-1 pr-2.5 pl-2 text-[10px] font-[650] ${ready ? "bg-[#2e2e2e] text-[#c9cdd6]" : "bg-[#3a2e1a] text-[#e0a24e]"}`}
    >
      <Icon size={10} /> {label}
    </span>
  );
}
