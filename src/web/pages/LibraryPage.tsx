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
      <header className="page-header">
        <div>
          <h1>Library</h1>
          <p>8 tools ready to grow with your workflow.</p>
        </div>
        <div className="header-actions">
          <label className="search">
            <Search size={14} />
            <input aria-label="Search tools" placeholder="Search tools" />
          </label>
          <Button size="sm" onClick={() => navigate("/forge")}>
            <Plus size={14} /> Forge a tool
          </Button>
        </div>
      </header>

      <section className="drop-hint">
        <div>
          <Files size={16} />
          <span>Drop files here to find a matching tool</span>
        </div>
        <Button variant="outlined" size="sm">
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
        <div className="loading">
          <Spinner />
          <span>Loading your tools…</span>
        </div>
      ) : tools.error ? (
        <Alert variant="error" title="Could not load tools" description="The local library request failed." />
      ) : (
        <section className="tool-grid" aria-label="Tool library">
          {tools.data?.tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </section>
      )}

      <section className="empty-panel">
        <div className="empty-icon">
          <Sparkles size={18} />
        </div>
        <div className="empty-copy">
          <h2>Your library is only the beginning</h2>
          <p>Describe the next utility you need. Codex will forge it locally after you approve it.</p>
        </div>
        <Button variant="outlined" size="sm" onClick={() => navigate("/forge")}>
          <Hammer size={14} /> Forge your first tool
        </Button>
      </section>

      <footer className="server-status">
        <span className={health.data?.ok ? "online" : "offline"} />
        {health.data?.ok ? "Local server ready" : "Connecting…"}
      </footer>
    </>
  );
}
