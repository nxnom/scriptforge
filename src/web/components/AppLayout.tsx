import { Button } from "@geckoui/geckoui";
import { Check, ChevronDown, Hammer, Library, Plus, Settings, Sparkles, Wrench } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <NavLink className="brand" to="/">
        <div className="brand-mark">
          <Hammer size={16} />
        </div>
        <span>ScriptForge</span>
      </NavLink>

      <Button className="forge-button" size="sm" onClick={() => navigate("/forge")}>
        <Hammer size={15} /> Forge a new tool
      </Button>

      <nav className="nav">
        <span className="nav-heading">Workspace</span>
        <NavLink className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} end to="/">
          <Library size={15} /> Library <span>8</span>
        </NavLink>
        <NavLink className="nav-item" to="/forge">
          <Sparkles size={15} /> Forge queue
        </NavLink>
        <span className="nav-heading section-gap">Filters</span>
        <NavLink className="nav-item" to="/">
          <Wrench size={15} /> All tools
        </NavLink>
        <NavLink className="nav-item" to="/">
          <Check size={15} /> Ready <span>1</span>
        </NavLink>
        <NavLink className="nav-item" to="/">
          <Plus size={15} /> Planned <span>7</span>
        </NavLink>
      </nav>

      <div className="sidebar-spacer" />
      <NavLink className="nav-item settings-link" to="/settings">
        <Settings size={15} /> Settings
      </NavLink>
      <div className="profile">
        <div className="avatar">SF</div>
        <div>
          <strong>Local workspace</strong>
          <small>127.0.0.1</small>
        </div>
        <ChevronDown size={14} />
      </div>
    </aside>
  );
}

export function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
