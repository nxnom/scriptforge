import { Alert, Spinner } from "@geckoui/geckoui";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useRead } from "../api";
import { LibraryRail } from "../components/LibraryRail";
import {
  type CategoryCount,
  type LibraryFilter,
  type LibrarySort,
  LibraryToolbar,
  type LibraryView,
} from "../components/LibraryToolbar";
import { ToolArchiveImport } from "../components/ToolArchiveImport";
import { ToolCard, type ToolSummary } from "../components/ToolCard";

export function LibraryPage() {
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [view, setView] = useState<LibraryView>("grid");
  const health = useRead((api) => api("health").GET(), { staleTime: 30_000 });
  const tools = useRead((api) => api("tools").GET(), { staleTime: 30_000 });
  const allTools = (tools.data?.tools ?? []).filter((tool) => tool.status !== "planned");
  const counts = countTools(allTools);
  const categories = countCategories(allTools);
  const visibleTools = useMemo(
    () => selectTools(allTools, searchParams.get("q") ?? "", filter, category, sort),
    [allTools, category, filter, searchParams, sort],
  );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-320 flex-1 gap-6 overflow-hidden">
      <LibraryRail
        counts={counts}
        filter={filter}
        categories={categories}
        category={category}
        onFilter={setFilter}
        onCategory={setCategory}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
        <LibraryToolbar
          count={visibleTools.length}
          counts={counts}
          filter={filter}
          categories={categories}
          category={category}
          sort={sort}
          view={view}
          onFilter={setFilter}
          onCategory={setCategory}
          onSort={setSort}
          onView={setView}
        />
        <ToolArchiveImport />

        <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-1">
          {health.error ? (
            <Alert
              variant="error"
              title="Local server unavailable"
              description="Retry after ScriptForge finishes starting."
            />
          ) : tools.loading ? (
            <LibraryLoading />
          ) : tools.error ? (
            <Alert variant="error" title="Could not load tools" description="The local library request failed." />
          ) : visibleTools.length ? (
            <section
              className={
                view === "grid"
                  ? "grid grid-cols-3 gap-3 max-[1120px]:grid-cols-2 max-[620px]:grid-cols-1"
                  : "grid grid-cols-1 gap-2"
              }
              aria-label="Tool library"
            >
              {visibleTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} layout={view} />
              ))}
            </section>
          ) : (
            <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-[#383838] text-sm text-[#7a7a7a]">
              No tools match this view.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function selectTools(
  tools: ToolSummary[],
  query: string,
  filter: LibraryFilter,
  category: string | null,
  sort: LibrarySort,
) {
  const normalized = query.trim().toLowerCase();
  return tools
    .filter((tool) => {
      const matchesQuery =
        !normalized ||
        `${tool.name} ${tool.description} ${tool.categories.join(" ")}`.toLowerCase().includes(normalized);
      const matchesCategory =
        !category || tool.categories.some((item) => item.toLocaleLowerCase() === category.toLocaleLowerCase());
      if (!matchesQuery || !matchesCategory) return false;
      if (filter === "ready") return tool.status === "ready";
      if (filter === "needs-install") return tool.status === "needs-install" || tool.status === "needs-config";
      if (filter === "builtin") return tool.origin === "bundled";
      if (filter === "imported") return tool.origin === "installed";
      return true;
    })
    .sort((left, right) =>
      sort === "name" ? left.name.localeCompare(right.name) : (right.createdAt ?? 0) - (left.createdAt ?? 0),
    );
}

function countTools(tools: ToolSummary[]): Record<LibraryFilter, number> {
  return {
    all: tools.length,
    ready: tools.filter((tool) => tool.status === "ready").length,
    "needs-install": tools.filter((tool) => tool.status === "needs-install" || tool.status === "needs-config").length,
    builtin: tools.filter((tool) => tool.origin === "bundled").length,
    imported: tools.filter((tool) => tool.origin === "installed").length,
  };
}

export function countCategories(tools: ToolSummary[]): CategoryCount[] {
  const counts = new Map<string, CategoryCount>();
  for (const tool of tools)
    for (const name of tool.categories) {
      const key = name.toLocaleLowerCase();
      const current = counts.get(key);
      counts.set(key, { name: current?.name ?? name, count: (current?.count ?? 0) + 1 });
    }
  return [...counts.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function LibraryLoading() {
  return (
    <div className="flex min-h-60 items-center justify-center gap-2.5 text-[13px] text-[#b0b0b0]">
      <Spinner /> <span>Loading your tools…</span>
    </div>
  );
}
