import { Button, Menu, MenuItem, MenuTrigger, Select, SelectOption, SelectTrigger, Tooltip } from "@geckoui/geckoui";
import { ChevronDown, Grid2X2, List } from "lucide-react";

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

      <div className="hidden min-w-0 flex-1 gap-2 max-[900px]:flex">
        <FilterSelect filter={filter} counts={counts} onFilter={onFilter} />
        <CategorySelect category={category} categories={categories} onCategory={onCategory} />
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

function FilterSelect({
  filter,
  counts,
  onFilter,
}: {
  filter: LibraryFilter;
  counts: Record<LibraryFilter, number>;
  onFilter: (filter: LibraryFilter) => void;
}) {
  const selected = filters.find((item) => item.value === filter);
  return (
    <Select value={filter} onChange={(value) => onFilter(value as LibraryFilter)}>
      <SelectTrigger>
        {({ toggleMenu }) => (
          <Button
            className="min-w-31 justify-between border-[#333] text-[#b0b0b0]"
            size="xs"
            variant="outlined"
            onClick={toggleMenu}
          >
            {selected?.label} · {counts[filter]} <ChevronDown size={11} />
          </Button>
        )}
      </SelectTrigger>
      {filters.map((item) => (
        <SelectOption key={item.value} value={item.value} label={`${item.label} · ${counts[item.value]}`} />
      ))}
    </Select>
  );
}

function CategorySelect({
  category,
  categories,
  onCategory,
}: {
  category: string | null;
  categories: CategoryCount[];
  onCategory: (category: string | null) => void;
}) {
  return (
    <Select value={category ?? "all"} onChange={(value) => onCategory(value === "all" ? null : value)}>
      <SelectTrigger>
        {({ toggleMenu }) => (
          <Button
            className="max-w-40 justify-between border-[#333] text-[#b0b0b0]"
            size="xs"
            variant="outlined"
            onClick={toggleMenu}
          >
            <span className="truncate">{category ?? "All categories"}</span>{" "}
            <ChevronDown className="shrink-0" size={11} />
          </Button>
        )}
      </SelectTrigger>
      <SelectOption value="all" label="All categories" />
      {categories.map((item) => (
        <SelectOption key={item.name} value={item.name} label={`${item.name} · ${item.count}`} />
      ))}
    </Select>
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
