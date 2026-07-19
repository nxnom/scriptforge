import { Button, Tooltip } from "@geckoui/geckoui";
import { Flame, Search } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ForgeLaunchButton } from "./ForgeLaunchButton";

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const onLibrary = location.pathname === "/";

  const updateSearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  return (
    <header className="shrink-0 border-[#333] border-b px-10 py-4 max-[900px]:px-6 max-[560px]:px-4">
      <div className="mx-auto flex min-h-8.5 w-full max-w-320 items-center justify-between gap-5">
        <Link className="flex shrink-0 items-center gap-2.5 text-[#ececec] no-underline" to="/">
          <span className="grid size-8.5 place-items-center rounded-[11px] bg-[#2e2e2e]">
            <Flame size={19} />
          </span>
          <strong className="font-[Geist_Variable] text-lg font-semibold max-[480px]:hidden">ScriptForge</strong>
        </Link>

        <div className="flex min-w-0 items-center gap-3">
          {onLibrary && (
            <label className="flex w-60 items-center gap-2 rounded-[10px] border border-[#333] bg-[#242424] px-3 py-2 text-[#7a7a7a] max-[700px]:w-40 max-[560px]:hidden">
              <Search size={16} />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#ececec] outline-none placeholder:text-[#7a7a7a]"
                aria-label="Search tools"
                placeholder="Search tools"
                value={searchParams.get("q") ?? ""}
                onChange={(event) => updateSearch(event.target.value)}
              />
            </label>
          )}
          <ForgeLaunchButton />
          <Tooltip content="Settings" triggerAsChild>
            <Button
              aria-label="Settings"
              className="size-8 rounded-full bg-[#343434] p-0 text-[11px] text-white"
              variant="icon"
              onClick={() => navigate("/settings")}
            >
              SF
            </Button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
