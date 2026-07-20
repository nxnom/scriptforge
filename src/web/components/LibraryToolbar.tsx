import { Button, Menu, MenuItem, MenuTrigger, Tooltip } from "@geckoui/geckoui";
import { Check, ChevronDown, Grid2X2, List } from "lucide-react";

export type LibraryFilter = "all" | "ready" | "needs-install" | "builtin" | "imported";
export type LibrarySort = "name" | "recent";
export type LibraryView = "grid" | "list";
export type CategoryCount = { name: string; count: number };

const filters: { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "All tools" },
  { value: "ready", label: "Ready" },
  { value: "needs-install", label: "Needs install" },
  { value: "builtin", label: "Built-in" },
  { value: "imported", label: "Imported" },
];

export function LibraryToolbar({
  count,
  counts,
  filter,
  categories,
  category,
  sort,
  view,
  onFilter,
  onCategory,
  onSort,
  onView,
}: {
  count: number;
  counts: Record<LibraryFilter, number>;
  filter: LibraryFilter;
  categories: CategoryCount[];
  category: string | null;
  sort: LibrarySort;
  view: LibraryView;
  onFilter: (filter: LibraryFilter) => void;
  onCategory: (category: string | null) => void;
  onSort: (sort: LibrarySort) => void;
  onView: (view: LibraryView) => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3">
      <div className="flex items-baseline gap-2 max-[900px]:hidden">
        <h1 className="m-0 font-[Geist_Variable] text-lg font-semibold">All tools</h1>
        <span className="text-[11px] text-[#707070]">{count}</span>
      </div>

      <div className="hidden min-w-0 flex-1 max-[900px]:flex">
        <MobileFilterMenu
          filter={filter}
          counts={counts}
          category={category}
          categories={categories}
          onFilter={onFilter}
          onCategory={onCategory}
        />
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
          <MenuItem onClick={() => onSort("recent")}>Recently added</MenuItem>
          <MenuItem onClick={() => onSort("name")}>Name, A–Z</MenuItem>
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

function MobileFilterMenu({
  filter,
  counts,
  category,
  categories,
  onFilter,
  onCategory,
}: {
  filter: LibraryFilter;
  counts: Record<LibraryFilter, number>;
  category: string | null;
  categories: CategoryCount[];
  onFilter: (filter: LibraryFilter) => void;
  onCategory: (category: string | null) => void;
}) {
  const selected = filters.find((item) => item.value === filter);
  return (
    <Menu
      className="min-w-0 flex-1"
      menuClassName="max-h-[min(70vh,32rem)] min-w-64 overflow-y-auto overscroll-contain"
      placement="bottom-start"
    >
      <MenuTrigger>
        {({ toggleMenu, open }) => (
          <Button
            aria-expanded={open}
            aria-label="Filter tools"
            className="w-full min-w-0 justify-between border-[#333] text-[#b0b0b0]"
            size="xs"
            variant="outlined"
            onClick={toggleMenu}
          >
            <span className="truncate">
              {selected?.label} · {category ?? "All categories"}
            </span>
            <ChevronDown className="shrink-0" size={11} />
          </Button>
        )}
      </MenuTrigger>
      <MenuGroupLabel>Availability</MenuGroupLabel>
      {filters.map((item) => (
        <MenuItem key={item.value} onClick={() => onFilter(item.value)}>
          <CheckedMenuLabel checked={filter === item.value}>
            {item.label} · {counts[item.value]}
          </CheckedMenuLabel>
        </MenuItem>
      ))}
      <div aria-hidden="true" className="my-1 h-px bg-[#393939]" />
      <MenuGroupLabel>Category</MenuGroupLabel>
      <MenuItem onClick={() => onCategory(null)}>
        <CheckedMenuLabel checked={category === null}>All categories</CheckedMenuLabel>
      </MenuItem>
      {categories.map((item) => (
        <MenuItem key={item.name} onClick={() => onCategory(item.name)}>
          <CheckedMenuLabel checked={category === item.name}>
            {item.name} · {item.count}
          </CheckedMenuLabel>
        </MenuItem>
      ))}
    </Menu>
  );
}

function MenuGroupLabel({ children }: React.PropsWithChildren) {
  return (
    <div className="px-3 pt-2 pb-1 text-[9px] font-semibold text-[#727272] uppercase tracking-[0.1em]">{children}</div>
  );
}

function CheckedMenuLabel({ checked, children }: React.PropsWithChildren<{ checked: boolean }>) {
  return (
    <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
      <span className="truncate">{children}</span>
      <Check aria-hidden="true" className={checked ? "text-white" : "invisible"} size={14} />
    </span>
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
