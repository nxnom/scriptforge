import { Button } from "@geckoui/geckoui";
import { Check, ChevronDown, Hammer, Library, Plus, Settings, Sparkles, Wrench } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

const navBase =
  "flex min-h-8.5 items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-[13px] text-[#b0b0b0] no-underline hover:bg-[#2e2e2e] hover:text-[#ececec]";

function Sidebar() {
  const navigate = useNavigate();
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `${navBase} ${isActive ? "bg-[#2e2e2e] text-[#ececec]" : ""}`;

  return (
    <aside className="sticky top-0 flex h-screen w-60 flex-col gap-4 border-[#333] border-r bg-[#1a1a1a] p-4.5 max-[1040px]:w-52.5 max-[760px]:static max-[760px]:z-10 max-[760px]:h-auto max-[760px]:w-full max-[760px]:flex-row max-[760px]:items-center max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:px-3.5 max-[760px]:py-2.5">
      <NavLink
        className="flex items-center gap-2.5 px-1 py-0.5 font-[650] font-[Geist_Variable] text-base text-[#ececec] no-underline max-[760px]:mr-auto"
        to="/"
      >
        <div className="grid size-8 place-items-center rounded-[11px] bg-[#2e2e2e]">
          <Hammer size={16} />
        </div>
        <span>ScriptForge</span>
      </NavLink>

      <Button
        className="w-full justify-center gap-2 rounded-[10px] max-[760px]:w-auto max-[560px]:size-8.5 max-[560px]:p-0 max-[560px]:text-[0px]"
        size="sm"
        onClick={() => navigate("/forge")}
      >
        <Hammer size={15} /> Forge a new tool
      </Button>

      <nav className="flex flex-col gap-0.5 max-[760px]:hidden">
        <span className="px-2.5 py-1 text-[10px] text-[#7a7a7a] uppercase tracking-[.08em]">Workspace</span>
        <NavLink className={navClass} end to="/">
          <Library size={15} /> Library <Count>8</Count>
        </NavLink>
        <NavLink className={navClass} to="/forge">
          <Sparkles size={15} /> Forge queue
        </NavLink>
        <span className="mt-2.5 px-2.5 py-1 text-[10px] text-[#7a7a7a] uppercase tracking-[.08em]">Filters</span>
        <NavLink className={navBase} to="/">
          <Wrench size={15} /> All tools
        </NavLink>
        <NavLink className={navBase} to="/">
          <Check size={15} /> Ready <Count>1</Count>
        </NavLink>
        <NavLink className={navBase} to="/">
          <Plus size={15} /> Planned <Count>7</Count>
        </NavLink>
      </nav>

      <div className="flex-1 max-[760px]:hidden" />
      <NavLink className={`${navBase} max-[760px]:hidden`} to="/settings">
        <Settings size={15} /> Settings
      </NavLink>
      <div className="flex items-center gap-2.5 rounded-xl border border-[#333] bg-[#242424] p-2 max-[760px]:hidden">
        <div className="grid size-7.5 place-items-center rounded-[9px] bg-[#2e2e2e] text-[10px] font-bold">SF</div>
        <div className="flex min-w-0 flex-1 flex-col">
          <strong className="text-[11px] font-semibold">Local workspace</strong>
          <small className="text-[10px] text-[#7a7a7a]">127.0.0.1</small>
        </div>
        <ChevronDown size={14} />
      </div>
    </aside>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return <span className="ml-auto text-[11px] text-[#7a7a7a]">{children}</span>;
}

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-[#1a1a1a] max-[760px]:flex-col">
      <Sidebar />
      <main className="flex w-[calc(100%-240px)] min-w-0 flex-1 flex-col gap-5 px-7.5 pt-6 pb-7 max-[1040px]:w-[calc(100%-210px)] max-[1040px]:px-5.5 max-[760px]:w-full max-[760px]:p-4.5 max-[560px]:gap-4 max-[560px]:p-3.5">
        <Outlet />
      </main>
    </div>
  );
}
