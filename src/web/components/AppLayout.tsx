import { Outlet, useLocation } from "react-router-dom";
import { AppHeader } from "./AppHeader";

export function AppLayout() {
  const location = useLocation();
  const toolRoute = location.pathname.startsWith("/tools/");
  const toolDetailRoute = /^\/tools\/[^/]+\/?$/.test(location.pathname);
  const forgeRoute = location.pathname === "/forge";
  const workspaceRoute = toolDetailRoute || forgeRoute;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#1a1a1a]">
      {!toolRoute && !forgeRoute && <AppHeader />}
      <main
        className={`flex min-h-0 w-full flex-1 flex-col overflow-hidden ${
          workspaceRoute ? "" : "px-10 pt-7.5 pb-6 max-[900px]:px-6 max-[560px]:px-4 max-[560px]:pt-5 max-[560px]:pb-4"
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
