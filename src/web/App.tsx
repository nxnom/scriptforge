import { Alert, Button, Spinner } from "@geckoui/geckoui";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Files,
  Hammer,
  Image,
  Library,
  Plus,
  Search,
  Settings,
  Sparkles,
  Table2,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import { useRead } from "./api";

const ICONS: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  image: Image,
  files: Files,
  table: Table2,
  "file-text": FileText,
};

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Hammer size={17} /></div>
        <span>ScriptForge</span>
      </div>

      <Button className="forge-button" size="md">
        <Hammer size={17} /> Forge a new tool
      </Button>

      <nav className="nav">
        <span className="nav-heading">Workspace</span>
        <a className="nav-item active" href="#library"><Library size={16} /> Library <span>4</span></a>
        <a className="nav-item" href="#queue"><Sparkles size={16} /> Forge queue</a>
        <span className="nav-heading section-gap">Filters</span>
        <a className="nav-item" href="#all"><Wrench size={16} /> All tools</a>
        <a className="nav-item" href="#ready"><Check size={16} /> Ready <span>1</span></a>
        <a className="nav-item" href="#planned"><Plus size={16} /> Planned <span>3</span></a>
      </nav>

      <div className="sidebar-spacer" />
      <a className="nav-item" href="#settings"><Settings size={16} /> Settings</a>
      <div className="profile">
        <div className="avatar">SF</div>
        <div><strong>Local workspace</strong><small>127.0.0.1</small></div>
        <ChevronDown size={15} />
      </div>
    </aside>
  );
}

function ToolCard({ tool }: { tool: { id: string; name: string; description: string; category: string; icon: string; status: string } }) {
  const Icon = ICONS[tool.icon] ?? Wrench;
  const ready = tool.status === "ready";

  return (
    <article className={`tool-card ${ready ? "" : "planned"}`}>
      <div className="card-top">
        <div className="icon-tile"><Icon size={22} /></div>
        <span className={`status ${ready ? "ready" : "soon"}`}>{ready ? <Check size={12} /> : <Sparkles size={12} />}{ready ? "Ready" : "Planned"}</span>
      </div>
      <div className="card-copy">
        <h2>{tool.name}</h2>
        <p>{tool.description}</p>
      </div>
      <div className="card-footer">
        <span className="tag">{tool.category}</span>
        <button disabled={!ready}>{ready ? "Open" : "Soon"} <ArrowRight size={13} /></button>
      </div>
    </article>
  );
}

export function App() {
  const health = useRead((api) => api("health").GET(), { staleTime: 30_000 });
  const tools = useRead((api) => api("tools").GET(), { staleTime: 30_000 });

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <header className="page-header">
          <div><h1>Library</h1><p>Small, focused tools forged for your workflow.</p></div>
          <div className="header-actions">
            <label className="search"><Search size={15} /><input aria-label="Search tools" placeholder="Search tools" /></label>
            <Button size="sm"><Plus size={15} /> Forge a tool</Button>
          </div>
        </header>

        <section className="drop-hint">
          <div><Files size={17} /><span>Drop files here to find a matching tool</span></div>
          <Button variant="outlined" size="sm">Browse files</Button>
        </section>

        {health.error && <Alert variant="error" title="Local server unavailable" description="Retry after ScriptForge finishes starting." />}

        {tools.loading ? (
          <div className="loading"><Spinner /><span>Loading your tools…</span></div>
        ) : tools.error ? (
          <Alert variant="error" title="Could not load tools" description="The local library request failed." />
        ) : (
          <section className="tool-grid" aria-label="Tool library">
            {tools.data?.tools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
          </section>
        )}

        <section className="empty-panel">
          <div className="empty-icon"><Sparkles size={19} /></div>
          <div className="empty-copy"><h2>Your library is only the beginning</h2><p>Describe the next utility you need. Codex will forge it locally and nothing runs before you approve it.</p></div>
          <Button variant="outlined" size="sm"><Hammer size={15} /> Forge your first tool</Button>
        </section>

        <footer className="server-status"><span className={health.data?.ok ? "online" : "offline"} />{health.data?.ok ? "Local server ready" : "Connecting…"}</footer>
      </main>
    </div>
  );
}
