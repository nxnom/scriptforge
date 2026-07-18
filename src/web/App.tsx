import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { ForgePage } from "./pages/ForgePage";
import { LibraryPage } from "./pages/LibraryPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ToolPage } from "./pages/ToolPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LibraryPage />} />
        <Route path="tools/:toolId" element={<ToolPage />} />
        <Route path="forge" element={<ForgePage />} />
        <Route
          path="settings"
          element={<PlaceholderPage title="Settings" description="Settings will grow with the local runtime." />}
        />
        <Route path="*" element={<PlaceholderPage title="Not found" description="That local page does not exist." />} />
      </Route>
    </Routes>
  );
}
