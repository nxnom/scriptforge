import { Tooltip } from "@geckoui/geckoui";
import { Search, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ForgeLaunchButton } from "./ForgeLaunchButton";

export function AppHeader() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const onLibrary = location.pathname === "/";
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!onLibrary) return;
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [onLibrary]);

  const updateSearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  return (
    <header className="shrink-0 border-[#333] border-b bg-[#1a1a1a] px-10 py-3.5 max-[900px]:px-6 max-[560px]:px-4">
      <div className="mx-auto grid min-h-9 w-full max-w-320 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-7">
        <Link className="flex shrink-0 items-center gap-2.5 text-[#ececec] no-underline" to="/">
          <span className="grid size-8 place-items-center rounded-[10px] bg-[#5468ff] text-white">
            <Zap size={17} />
          </span>
          <strong className="font-[Geist_Variable] text-[16.5px] font-semibold max-[480px]:hidden">ScriptForge</strong>
        </Link>

        <div className="flex min-w-0 justify-center">
          {onLibrary ? (
            <label className="flex w-full max-w-110 items-center gap-2 rounded-[10px] border border-[#333] bg-[#242424] px-3.5 py-2 text-[#7a7a7a] max-[680px]:hidden">
              <Search size={16} />
              <input
                ref={searchInput}
                className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#ececec] outline-none placeholder:text-[#7a7a7a]"
                aria-label="Search tools"
                placeholder="Search tools by name, category, or task…"
                value={searchParams.get("q") ?? ""}
                onChange={(event) => updateSearch(event.target.value)}
              />
              <kbd className="rounded-md bg-[#303030] px-1.5 py-0.5 font-sans text-[10px] text-[#929292]">⌘ K</kbd>
            </label>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ForgeLaunchButton idleLabel="New tool" />
          <Tooltip content="View ScriptForge on GitHub" triggerAsChild>
            <a
              href="https://github.com/nxnom/scriptforge"
              target="_blank"
              rel="noreferrer"
              aria-label="View ScriptForge on GitHub"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#343434] px-3 text-[12px] text-[#b5b5b5] no-underline transition-colors hover:bg-[#262626] hover:text-white focus-visible:outline-2 focus-visible:outline-[#5468ff] focus-visible:outline-offset-2 max-[560px]:size-9 max-[560px]:justify-center max-[560px]:px-0"
            >
              <svg aria-hidden="true" className="size-[15px] shrink-0 fill-current" viewBox="0 0 24 24">
                <path d="M12 .7a11.3 11.3 0 0 0-3.6 22c.6.1.8-.2.8-.5v-2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6A4.7 4.7 0 0 1 5.8 8c-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.5 1.3a12 12 0 0 1 6.3 0c2.4-1.6 3.4-1.3 3.4-1.3.7 1.7.3 3 .2 3.3a4.7 4.7 0 0 1 1.2 3.3c0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.2c0 .3.2.6.8.5A11.3 11.3 0 0 0 12 .7Z" />
              </svg>
              <span className="max-[560px]:hidden">GitHub</span>
            </a>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
