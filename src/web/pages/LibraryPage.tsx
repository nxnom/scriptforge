import { Alert, Spinner } from "@geckoui/geckoui";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useRead } from "../api";
import { type LibraryFilter, type LibrarySort, LibraryToolbar, type LibraryView } from "../components/LibraryToolbar";
import { ToolArchiveImport } from "../components/ToolArchiveImport";
import { ToolCard, type ToolSummary } from "../components/ToolCard";

export function LibraryPage() {
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [view, setView] = useState<LibraryView>("grid");
  const health = useRead((api) => api("health").GET(), { staleTime: 30_000 });
  const tools = useRead((api) => api("tools").GET(), { staleTime: 30_000 });
  const allTools = (tools.data?.tools ?? []).filter((tool) => tool.status !== "planned");
  const visibleTools = useMemo(
    () => selectTools(allTools, searchParams.get("q") ?? "", filter, sort),
    [allTools, filter, searchParams, sort],
  );
  const counts = countTools(allTools);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-320 flex-1 flex-col gap-4 overflow-hidden">
      <LibraryToolbar
        counts={counts}
        filter={filter}
        sort={sort}
        view={view}
        onFilter={setFilter}
        onSort={setSort}
        onView={setView}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-1">
        {health.error && (
          <Alert
            variant="error"
            title="Local server unavailable"
            description="Retry after ScriptForge finishes starting."
          />
        )}

        {tools.loading ? (
          <LibraryLoading />
        ) : tools.error ? (
          <Alert variant="error" title="Could not load tools" description="The local library request failed." />
        ) : visibleTools.length ? (
          <section
            className={
              view === "grid"
                ? "grid grid-cols-4 gap-3 max-[1160px]:grid-cols-3 max-[820px]:grid-cols-2 max-[520px]:grid-cols-1"
                : "grid grid-cols-1 gap-2.5"
            }
            aria-label="Tool library"
          >
            {visibleTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} layout={view} />
            ))}
          </section>
        ) : (
          <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-[#383838] text-sm text-[#7a7a7a]">
            No tools match this view.
          </div>
        )}
      </div>

      <div className="shrink-0">
        <ToolArchiveImport />
      </div>
    </div>
  );
}

function selectTools(tools: ToolSummary[], query: string, filter: LibraryFilter, sort: LibrarySort) {
  const normalized = query.trim().toLowerCase();
  return tools
    .filter((tool) => {
      const matchesQuery =
        !normalized || `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(normalized);
      if (!matchesQuery) return false;
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

function LibraryLoading() {
  return (
    <div className="flex min-h-75 items-center justify-center gap-2.5 text-[13px] text-[#b0b0b0]">
      <Spinner /> <span>Loading your tools…</span>
    </div>
  );
}
