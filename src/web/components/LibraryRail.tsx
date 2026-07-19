import { Box, Check, Download, PackageOpen, Tag, Wrench } from "lucide-react";
import type { LibraryFilter } from "./LibraryToolbar";

type CategoryCount = { name: string; count: number };

const filters = [
  { value: "all", label: "All tools", icon: Wrench },
  { value: "ready", label: "Ready", icon: Check },
  { value: "needs-install", label: "Needs install", icon: Download },
  { value: "builtin", label: "Built-in", icon: Box },
  { value: "imported", label: "Imported", icon: PackageOpen },
] as const;

export function LibraryRail({
  counts,
  filter,
  categories,
  category,
  onFilter,
  onCategory,
}: {
  counts: Record<LibraryFilter, number>;
  filter: LibraryFilter;
  categories: CategoryCount[];
  category: string | null;
  onFilter: (filter: LibraryFilter) => void;
  onCategory: (category: string | null) => void;
}) {
  return (
    <aside className="flex min-h-0 w-55 shrink-0 flex-col gap-5 max-[900px]:hidden" aria-label="Library filters">
      <RailSection title="Library">
        {filters.map(({ value, label, icon: Icon }) => (
          <RailButton
            key={value}
            active={filter === value}
            label={label}
            count={counts[value]}
            onClick={() => onFilter(value)}
          >
            <Icon size={14} />
          </RailButton>
        ))}
      </RailSection>

      <RailSection title="Categories">
        <RailButton active={category === null} label="All categories" onClick={() => onCategory(null)}>
          <Tag size={14} />
        </RailButton>
        {categories.map((item) => (
          <RailButton
            key={item.name}
            active={category === item.name}
            label={item.name}
            count={item.count}
            onClick={() => onCategory(item.name)}
          >
            <span className="size-2 rounded-full bg-[#5468ff]" />
          </RailButton>
        ))}
      </RailSection>
    </aside>
  );
}

function RailSection({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className="flex flex-col gap-1 rounded-2xl border border-[#333] bg-[#242424] p-3">
      <h2 className="m-0 px-2 pt-0.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#707070]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function RailButton({
  active,
  label,
  count,
  onClick,
  children,
}: React.PropsWithChildren<{ active: boolean; label: string; count?: number; onClick: () => void }>) {
  return (
    <button
      className={`flex w-full items-center gap-2.5 rounded-[9px] border-0 px-2.5 py-2 text-left text-[12px] ${active ? "bg-[#252945] text-[#eef0ff]" : "bg-transparent text-[#a0a0a0] hover:bg-[#2c2c2c] hover:text-[#ececec]"}`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      <span className={active ? "text-[#7f8fff]" : "text-[#777]"}>{children}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-[10px] text-[#707070]">{count}</span>}
    </button>
  );
}
