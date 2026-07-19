import {
  AudioWaveform,
  Box,
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
import { paletteFor, type ToolPalette } from "./tool-card-palette";

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
  version?: string;
  name: string;
  description: string;
  categories: string[];
  icon: string;
  status: string;
  origin?: "bundled" | "installed";
  execution?: "local";
  runtime?: string;
  createdAt?: number;
}

export function ToolCard({ tool, layout = "grid" }: { tool: ToolSummary; layout?: "grid" | "list" }) {
  const Icon = icons[tool.icon] ?? Wrench;
  const palette = paletteFor(tool.categories[0] ?? tool.id);
  const available = ["ready", "needs-install", "needs-config"].includes(tool.status);
  const className = `group relative h-full border border-[#363636] bg-[linear-gradient(145deg,#262626_0%,#222222_62%)] transition-[border-color,box-shadow] duration-150 ${available ? palette.hover : ""} ${tool.status === "ready" ? "shadow-[0_6px_20px_-8px_#00000070]" : ""}`;

  return (
    <article
      data-palette={palette.name}
      className={`${className} ${layout === "grid" ? "min-h-44 rounded-[18px]" : "min-h-24 rounded-xl"}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute top-0 left-5 h-px w-24 bg-gradient-to-r opacity-45 transition-opacity group-hover:opacity-75 ${palette.accent}`}
      />
      {available && (
        <Link
          aria-label={`Open ${tool.name}`}
          className="absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-[#777]"
          to={`/tools/${tool.id}`}
        />
      )}
      {layout === "grid" ? (
        <GridCardContent tool={tool} Icon={Icon} palette={palette} />
      ) : (
        <ListCardContent tool={tool} Icon={Icon} palette={palette} />
      )}
    </article>
  );
}

function GridCardContent({
  tool,
  Icon,
  palette,
}: {
  tool: ToolSummary;
  Icon: ComponentType<{ size?: number }>;
  palette: ToolPalette;
}) {
  return (
    <div className="pointer-events-none relative flex h-full min-h-44 flex-col gap-3 p-3.5">
      <div className="flex items-center justify-between">
        <ToolIcon Icon={Icon} palette={palette} />
        <StatusBadge status={tool.status} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <ToolCopy tool={tool} />
      </div>
      <CardFooter tool={tool} />
    </div>
  );
}

function ListCardContent({
  tool,
  Icon,
  palette,
}: {
  tool: ToolSummary;
  Icon: ComponentType<{ size?: number }>;
  palette: ToolPalette;
}) {
  return (
    <div className="pointer-events-none relative grid min-h-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 max-[620px]:grid-cols-[auto_minmax(0,1fr)]">
      <ToolIcon Icon={Icon} palette={palette} />
      <div className="min-w-0">
        <ToolCopy tool={tool} />
      </div>
      <div className="flex items-center gap-3 max-[620px]:col-span-2 max-[620px]:justify-end">
        <CategoryBadges categories={tool.categories} />
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

function ToolIcon({ Icon, palette }: { Icon: ComponentType<{ size?: number }>; palette: ToolPalette }) {
  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${palette.icon}`}>
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
      <CategoryBadges categories={tool.categories} />
      <div className="flex items-center gap-2">
        {tool.origin === "bundled" && <BuiltinBadge />}
        {tool.origin === "installed" && <ToolActions mode="menu" toolId={tool.id} toolName={tool.name} />}
      </div>
    </div>
  );
}

function CategoryBadges({ categories }: { categories: string[] }) {
  return (
    <span className="flex min-w-0 items-center gap-1 overflow-hidden">
      {categories.map((category) => (
        <span
          key={category}
          className="max-w-24 truncate rounded-full bg-[#2d2d2d] px-2.5 py-1 text-[10px] text-[#b8b8b8] ring-1 ring-[#3a3a3a] ring-inset"
        >
          {category}
        </span>
      ))}
    </span>
  );
}

function BuiltinBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#3f466d] bg-[#292c3c] px-2 py-1 text-[10px] text-[#aeb7ff]">
      <Box size={10} /> Built-in
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ready") return null;
  const needsInstall = status === "needs-install";
  const needsConfig = status === "needs-config";
  const Icon = needsInstall ? Download : needsConfig ? KeyRound : Sparkles;
  const label = needsInstall ? "Needs install" : needsConfig ? "Setup required" : "Unavailable";
  const tone = needsInstall
    ? "bg-[#44331e] text-[#e8b76d] ring-[#6a4e2b]"
    : needsConfig
      ? "bg-[#35284a] text-[#c8a8f2] ring-[#584275]"
      : "bg-[#3d2528] text-[#e69a9f] ring-[#66383d]";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full py-1 pr-2.5 pl-2 text-[10px] font-[650] ring-1 ring-inset ${tone}`}
    >
      <Icon size={10} /> {label}
    </span>
  );
}
