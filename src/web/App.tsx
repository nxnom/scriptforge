import { Spinner } from "@geckoui/geckoui";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { LibraryPage } from "./pages/LibraryPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ToolPage } from "./pages/ToolPage";
import { ToolSettingsPage } from "./pages/ToolSettingsPage";

const ForgePage = lazy(() => import("./pages/ForgePage").then((module) => ({ default: module.ForgePage })));

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LibraryPage />} />
        <Route path="tools/:toolId" element={<ToolPage />} />
        <Route path="tools/:toolId/settings" element={<ToolSettingsPage />} />
        <Route
          path="forge"
          element={
            <Suspense fallback={<Spinner className="m-auto" />}>
              <ForgePage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={<PlaceholderPage title="Settings" description="Settings will grow with the local runtime." />}
        />
        <Route path="*" element={<PlaceholderPage title="Not found" description="That local page does not exist." />} />
      </Route>
    </Routes>
  );
}
