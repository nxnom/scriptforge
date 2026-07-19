import { Button, Menu, MenuItem, MenuTrigger, Select, SelectOption, SelectTrigger, Tooltip } from "@geckoui/geckoui";
import { Box, Check, ChevronDown, Download, Grid2X2, List, PackageOpen, Wrench } from "lucide-react";

export type LibraryFilter = "all" | "ready" | "needs-install" | "builtin" | "imported";
export type LibrarySort = "name" | "recent";
export type LibraryView = "grid" | "list";

type Props = {
  counts: Record<LibraryFilter, number>;
  filter: LibraryFilter;
  sort: LibrarySort;
  view: LibraryView;
  onFilter: (filter: LibraryFilter) => void;
  onSort: (sort: LibrarySort) => void;
  onView: (view: LibraryView) => void;
};

const filters = [
  { value: "all", label: "All tools", icon: Wrench },
  { value: "ready", label: "Ready", icon: Check },
  { value: "needs-install", label: "Needs install", icon: Download },
  { value: "builtin", label: "Built-in", icon: Box },
  { value: "imported", label: "Imported", icon: PackageOpen },
] as const;

export function LibraryToolbar({ counts, filter, sort, view, onFilter, onSort, onView }: Props) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3">
      <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] border border-[#333] bg-[#242424] p-0.5 max-[760px]:hidden">
        {filters.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            className={`flex shrink-0 items-center gap-1.5 rounded-[7px] border-0 px-2.5 py-1.5 text-[11px] ${filter === value ? "bg-[#2e2e2e] text-[#ececec]" : "bg-transparent text-[#929292] hover:text-[#ececec]"}`}
            type="button"
            aria-pressed={filter === value}
            onClick={() => onFilter(value)}
          >
            <Icon size={12} /> {label}
            <span className="text-[9px] text-[#707070]">{counts[value]}</span>
          </button>
        ))}
      </div>

      <div className="hidden max-[760px]:block">
        <Select value={filter} onChange={(value) => onFilter(value as LibraryFilter)}>
          <SelectTrigger>
            {({ toggleMenu }) => (
              <Button
                className="min-w-34 justify-between gap-2 border-[#333] text-[#b0b0b0]"
                size="xs"
                variant="outlined"
                onClick={toggleMenu}
              >
                {filters.find(({ value }) => value === filter)?.label} · {counts[filter]}
                <ChevronDown size={11} />
              </Button>
            )}
          </SelectTrigger>
          {filters.map(({ value, label }) => (
            <SelectOption key={value} value={value} label={`${label} · ${counts[value]}`} />
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Menu placement="bottom-end">
          <MenuTrigger>
            {({ toggleMenu }) => (
              <Button
                className="gap-1.5 border-[#333] text-[#b0b0b0]"
                size="xs"
                variant="outlined"
                onClick={toggleMenu}
              >
                {sort === "name" ? "A–Z" : "Recent"} <ChevronDown size={11} />
              </Button>
            )}
          </MenuTrigger>
          <MenuItem onClick={() => onSort("name")}>Name, A–Z</MenuItem>
          <MenuItem onClick={() => onSort("recent")}>Recently added</MenuItem>
        </Menu>
        <div className="flex rounded-lg border border-[#333] bg-[#242424] p-0.5">
          <ViewButton active={view === "grid"} label="Grid view" onClick={() => onView("grid")}>
            <Grid2X2 size={12} />
          </ViewButton>
          <ViewButton active={view === "list"} label="List view" onClick={() => onView("list")}>
            <List size={12} />
          </ViewButton>
        </div>
      </div>
    </div>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: React.PropsWithChildren<{ active: boolean; label: string; onClick: () => void }>) {
  return (
    <Tooltip content={label} triggerAsChild>
      <button
        aria-label={label}
        aria-pressed={active}
        className={`grid size-6 place-items-center rounded-[6px] border-0 ${active ? "bg-[#353535] text-white" : "bg-transparent text-[#777] hover:text-white"}`}
        type="button"
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}
