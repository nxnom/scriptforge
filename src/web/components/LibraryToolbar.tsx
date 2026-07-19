import { Button, Menu, MenuItem, MenuTrigger, Tooltip } from "@geckoui/geckoui";
import { Check, ChevronDown, Download, Grid2X2, List, PackageOpen, Wrench } from "lucide-react";

export type LibraryFilter = "all" | "ready" | "needs-install" | "imported";
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
  { value: "imported", label: "Imported", icon: PackageOpen },
] as const;

export function LibraryToolbar({ counts, filter, sort, view, onFilter, onSort, onView }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 max-[760px]:items-start max-[760px]:flex-col">
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[#333] bg-[#242424] p-1">
        {filters.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            className={`flex shrink-0 items-center gap-2 rounded-lg border-0 px-3 py-2 text-xs ${filter === value ? "bg-[#2e2e2e] text-[#ececec]" : "bg-transparent text-[#929292] hover:text-[#ececec]"}`}
            type="button"
            aria-pressed={filter === value}
            onClick={() => onFilter(value)}
          >
            <Icon size={14} /> {label}
            <span className="text-[10px] text-[#707070]">{counts[value]}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2.5">
        <Menu placement="bottom-end">
          <MenuTrigger>
            {({ toggleMenu }) => (
              <Button className="gap-2 border-[#333] text-[#b0b0b0]" size="sm" variant="outlined" onClick={toggleMenu}>
                {sort === "name" ? "A–Z" : "Recently added"} <ChevronDown size={13} />
              </Button>
            )}
          </MenuTrigger>
          <MenuItem onClick={() => onSort("name")}>Name, A–Z</MenuItem>
          <MenuItem onClick={() => onSort("recent")}>Recently added</MenuItem>
        </Menu>
        <div className="flex rounded-[9px] border border-[#333] bg-[#242424] p-1">
          <ViewButton active={view === "grid"} label="Grid view" onClick={() => onView("grid")}>
            <Grid2X2 size={14} />
          </ViewButton>
          <ViewButton active={view === "list"} label="List view" onClick={() => onView("list")}>
            <List size={14} />
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
        className={`grid size-7 place-items-center rounded-md border-0 ${active ? "bg-[#353535] text-white" : "bg-transparent text-[#777] hover:text-white"}`}
        type="button"
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}
