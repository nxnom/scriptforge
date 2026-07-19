import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoctorPage } from "./DoctorPage";

const mocks = vi.hoisted(() => ({
  active: { data: undefined as unknown, loading: false, trigger: vi.fn() },
  requirements: { data: undefined as unknown, loading: false, trigger: vi.fn() },
  tools: { data: undefined as unknown, loading: false, trigger: vi.fn() },
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("../api", () => ({
  invalidate: vi.fn(),
  useRead: (factory: unknown) => {
    const source = String(factory);
    if (source.includes("doctor/sessions/active")) return mocks.active;
    if (source.includes("requirements")) return mocks.requirements;
    return mocks.tools;
  },
  useWrite: (factory: unknown) =>
    String(factory).includes("DELETE")
      ? { trigger: mocks.stop, loading: false }
      : { trigger: mocks.start, loading: false },
}));

vi.mock("../doctor/DoctorTerminal", () => ({
  DoctorTerminal: () => <div>Doctor terminal</div>,
}));

vi.mock("../doctor/DoctorProposalPanel", () => ({
  DoctorProposalPanel: ({ proposal }: { proposal: { summary: string } }) => <div>{proposal.summary}</div>,
}));

beforeEach(() => {
  mocks.start.mockReset();
  mocks.stop.mockReset();
  mocks.active.trigger.mockReset();
  mocks.requirements.trigger.mockReset();
  mocks.tools.data = { tools: [{ id: "video-tool", name: "Video Tool" }] };
  mocks.requirements.data = {
    ok: true,
    ready: false,
    requirements: [{ name: "ffmpeg", available: false, detectedVersion: null, reason: "missing" }],
  };
  mocks.active.data = { ok: true, sessionId: null, toolId: null, proposal: null };
});

afterEach(cleanup);

describe("DoctorPage", () => {
  it("starts Doctor automatically after the explicit tool-page launch action", async () => {
    mocks.start.mockResolvedValue({ data: { ok: true, sessionId: "doctor-1" } });

    renderPage({ autoStart: true });

    await waitFor(() =>
      expect(mocks.start).toHaveBeenCalledWith({
        body: { toolId: "video-tool", model: "gpt-5.6-sol", effort: "medium" },
      }),
    );
    expect(mocks.start).toHaveBeenCalledOnce();
  });

  it("renders a restored proposal without mounting the Codex terminal", () => {
    mocks.active.data = {
      ok: true,
      sessionId: "doctor-1",
      toolId: "video-tool",
      proposal: { summary: "Install ffmpeg safely.", commands: [], createdAt: Date.now() },
    };

    renderPage();

    expect(screen.getByText("Install ffmpeg safely.")).toBeVisible();
    expect(screen.queryByText("Doctor terminal")).not.toBeInTheDocument();
  });
});

function renderPage(state?: { autoStart: boolean }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/doctor/video-tool", state }]}>
      <Routes>
        <Route path="/doctor/:toolId" element={<DoctorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
