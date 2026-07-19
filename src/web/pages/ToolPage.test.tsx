import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolPage } from "./ToolPage";

const mocks = vi.hoisted(() => ({
  openConfiguration: vi.fn(),
  refreshConfiguration: vi.fn(),
}));

vi.mock("../configuration/ToolConfigurationDialog", () => ({
  openInstalledConfiguration: mocks.openConfiguration,
}));

vi.mock("../api", () => ({
  invalidate: vi.fn(),
  useRead: (select: (api: typeof fakeApi) => { path: string }) => {
    const { path } = select(fakeApi);
    if (path === "tools") {
      return { data: { tools: [tool] }, trigger: vi.fn(), loading: false };
    }
    if (path.endsWith("/requirements")) {
      return { data: { ok: true, ready: true, requirements: [] }, trigger: vi.fn(), loading: false };
    }
    if (path.endsWith("/configuration")) {
      return {
        data: { ok: true, ready: true, fields: [{ key: "token" }] },
        trigger: mocks.refreshConfiguration,
        loading: false,
      };
    }
    return { data: {}, trigger: vi.fn(), loading: false };
  },
  useWrite: () => ({ trigger: vi.fn(), loading: false }),
}));

vi.mock("../tool-host/useToolHostBridge", () => ({
  normalizeToolFile: vi.fn(),
  useToolHostBridge: () => ({ listening: true, hostError: undefined }),
}));

vi.mock("../tool-detail/ToolInfoSidebar", () => ({ ToolInfoSidebar: () => <aside>Tool information</aside> }));
vi.mock("../tool-detail/ToolReview", () => ({ ToolReview: () => <main>Tool preview</main> }));
vi.mock("../doctor/ToolDoctorPanel", () => ({ ToolDoctorPanel: () => null }));
vi.mock("../components/ToolActions", () => ({ ToolActions: () => null }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ToolPage", () => {
  it("opens configuration in a dialog and stays on the tool page", async () => {
    mocks.openConfiguration.mockResolvedValue(true);
    render(
      <MemoryRouter initialEntries={["/tools/configurable-tool"]}>
        <Routes>
          <Route path="tools/:toolId" element={<ToolPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tool configuration" }));

    expect(mocks.openConfiguration).toHaveBeenCalledWith("configurable-tool");
    await waitFor(() => expect(mocks.refreshConfiguration).toHaveBeenCalled());
    expect(screen.getByText("Tool preview")).toBeVisible();
  });
});

const tool = {
  id: "configurable-tool",
  name: "Configurable Tool",
  description: "Uses local configuration.",
  categories: ["Utilities"],
  icon: "wrench",
  status: "ready",
  origin: "installed" as const,
  execution: "local" as const,
};

function fakeApi(path: string) {
  const request = { path };
  return {
    GET: () => request,
    POST: () => request,
    PUT: () => request,
  };
}
