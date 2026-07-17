import { Alert, Button, Spinner } from "@geckoui/geckoui";
import { Files, Hammer, Plus, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRead } from "../api";
import { ToolCard } from "../components/ToolCard";

export function LibraryPage() {
  const navigate = useNavigate();
  const health = useRead((api) => api("health").GET(), { staleTime: 30_000 });
  const tools = useRead((api) => api("tools").GET(), { staleTime: 30_000 });

  return (
    <>
      <header className="flex items-center justify-between gap-4 max-[560px]:flex-col max-[560px]:items-start">
        <div>
          <h1 className="m-0 font-[Geist_Variable] text-[23px] leading-tight">Library</h1>
          <p className="mt-1.5 mb-0 text-[13px] text-[#b0b0b0]">8 tools ready to grow with your workflow.</p>
        </div>
        <div className="flex items-center gap-3 max-[560px]:w-full">
          <label className="flex w-47.5 items-center gap-2 rounded-[9px] border border-[#333] bg-[#242424] px-2.5 py-2 text-[#7a7a7a] max-[560px]:flex-1">
            <Search size={14} />
            <input
              className="w-full border-0 bg-transparent text-xs text-[#ececec] outline-0"
              aria-label="Search tools"
              placeholder="Search tools"
            />
          </label>
          <Button className="whitespace-nowrap" size="sm" onClick={() => navigate("/forge")}>
            <Plus size={14} /> Forge a tool
          </Button>
        </div>
      </header>

      <section className="flex items-center justify-between rounded-xl border border-[#454545] bg-[#303030] px-4 py-3">
        <div className="flex items-center gap-3 text-xs text-[#b0b0b0]">
          <Files size={16} />
          <span>Drop files here to find a matching tool</span>
        </div>
        <Button className="border-[#454545] text-[#ececec]" variant="outlined" size="sm">
          Browse files
        </Button>
      </section>

      {health.error && (
        <Alert
          variant="error"
          title="Local server unavailable"
          description="Retry after ScriptForge finishes starting."
        />
      )}

      {tools.loading ? (
        <div className="flex min-h-75 items-center justify-center gap-2.5 text-[13px] text-[#b0b0b0]">
          <Spinner />
          <span>Loading your tools…</span>
        </div>
      ) : tools.error ? (
        <Alert variant="error" title="Could not load tools" description="The local library request failed." />
      ) : (
        <section
          className="grid grid-cols-4 gap-4 max-[1280px]:grid-cols-3 max-[1040px]:grid-cols-2 max-[560px]:grid-cols-1"
          aria-label="Tool library"
        >
          {tools.data?.tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </section>
      )}

      <section className="flex items-center gap-4.5 rounded-2xl border border-[#333] bg-[#242424] px-5.5 py-5 max-[560px]:flex-wrap max-[560px]:items-start">
        <div className="grid size-10.5 shrink-0 place-items-center rounded-xl bg-[#2e2e2e]">
          <Sparkles size={18} />
        </div>
        <div className="flex-1 max-[560px]:min-w-[calc(100%-60px)]">
          <h2 className="m-0 mb-1.5 font-[Geist_Variable] text-[15px]">Your library is only the beginning</h2>
          <p className="m-0 max-w-165 text-xs text-[#b0b0b0] leading-normal">
            Describe the next utility you need. Codex will forge it locally after you approve it.
          </p>
        </div>
        <Button
          className="whitespace-nowrap border-[#454545] text-[#ececec]"
          variant="outlined"
          size="sm"
          onClick={() => navigate("/forge")}
        >
          <Hammer size={14} /> Forge your first tool
        </Button>
      </section>

      <footer className="mt-auto flex items-center gap-2 text-[10px] text-[#7a7a7a]">
        <span
          className={`size-1.5 rounded-full ${health.data?.ok ? "bg-[#83bd8b] shadow-[0_0_8px_#83bd8b66]" : "bg-[#e0a24e]"}`}
        />
        {health.data?.ok ? "Local server ready" : "Connecting…"}
      </footer>
    </>
  );
}
