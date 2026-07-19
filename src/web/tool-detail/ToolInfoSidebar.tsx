import { Box, Check, CircleAlert, HardDrive, Image, PackageCheck, Wrench } from "lucide-react";
import type { ComponentType } from "react";
import type { Requirement } from "../components/RequirementNotice";
import type { ToolSummary } from "../components/ToolCard";
import { paletteFor } from "../components/tool-card-palette";

const icons: Record<string, ComponentType<{ size?: number }>> = { image: Image };

export function ToolInfoSidebar({ tool, requirements }: { tool: ToolSummary; requirements: Requirement[] }) {
  const Icon = icons[tool.icon] ?? Wrench;
  const palette = paletteFor(tool.id);

  return (
    <aside className="flex min-h-0 w-65 shrink-0 flex-col gap-3 overflow-y-auto pr-1 max-[900px]:w-full max-[900px]:overflow-visible max-[900px]:pr-0">
      <section
        data-palette={palette.name}
        className={`relative overflow-hidden rounded-2xl border border-[#333] bg-[linear-gradient(145deg,#272727_0%,#222222_68%)] p-4 ${palette.hover}`}
      >
        <span aria-hidden className={`absolute top-0 left-5 h-px w-24 bg-gradient-to-r ${palette.accent}`} />
        <span className={`grid size-11 place-items-center rounded-xl ring-1 ring-inset ${palette.icon}`}>
          <Icon size={20} />
        </span>
        <h2 className="mt-3.5 mb-1 font-[650] font-[Geist_Variable] text-[17px] leading-tight">{tool.name}</h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tool.categories.map((category) => (
            <CategoryBadge key={category} category={category} />
          ))}
          {tool.origin === "bundled" ? <BuiltinBadge /> : <LocalBadge />}
        </div>
        <p className="m-0 text-[11px] text-[#a7a7a7] leading-[1.55]">{tool.description}</p>
      </section>

      <InfoCard title="Specifications">
        <InfoRow
          icon={HardDrive}
          label="Runs"
          value={tool.execution === "local" ? "On this device" : "—"}
          good={tool.execution === "local"}
        />
        <InfoRow icon={PackageCheck} label="Version" value={tool.version ?? "—"} />
        <InfoRow icon={Box} label="Source" value={tool.origin === "bundled" ? "Built-in" : "Saved tool"} />
        <InfoRow icon={Wrench} label="Runtime" value={tool.runtime ?? "—"} />
      </InfoCard>

      <InfoCard title="Requirements">
        {requirements.length === 0 ? (
          <InfoRow icon={Check} label="Extra apps" value="None required" good />
        ) : (
          requirements.map((requirement) => {
            const available = requirement.reason === "available";
            return (
              <InfoRow
                key={requirement.name}
                icon={available ? Check : CircleAlert}
                label={requirement.name}
                value={available ? (requirement.detectedVersion ?? "Available") : "Needs install"}
                good={available}
                warning={!available}
              />
            );
          })
        )}
      </InfoCard>
    </aside>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const palette = paletteFor(category);
  return <span className={`rounded-full px-2 py-1 text-[9px] ring-1 ring-inset ${palette.icon}`}>{category}</span>;
}

function BuiltinBadge() {
  return (
    <span className="rounded-full border border-[#4655a1] bg-[#252a48] px-2 py-1 text-[9px] text-[#aeb7ff] shadow-[0_0_14px_-7px_#5468ff]">
      Built-in
    </span>
  );
}

function LocalBadge() {
  return <span className="rounded-full bg-[#303030] px-2 py-1 text-[9px] text-[#b9b9b9]">Local</span>;
}

function InfoCard({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className="rounded-2xl border border-[#333] bg-[#242424] px-4 py-3.5">
      <h3 className="mt-0 mb-2.5 font-[650] text-[11px] text-[#d4d4d4] uppercase tracking-[0.08em]">{title}</h3>
      <div className="grid gap-2.5">{children}</div>
    </section>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  good = false,
  warning = false,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string;
  good?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 text-[10px]">
      <Icon size={13} />
      <span className="truncate text-[#929292]">{label}</span>
      <span className={`max-w-28 truncate ${good ? "text-[#8bc895]" : warning ? "text-[#e0a24e]" : "text-[#d0d0d0]"}`}>
        {value}
      </span>
    </div>
  );
}
