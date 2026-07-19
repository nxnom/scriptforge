import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolDoctorPanel } from "./ToolDoctorPanel";

const mocks = vi.hoisted(() => ({
  active: { data: undefined as unknown, loading: false, trigger: vi.fn() },
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("../api", () => ({
  useRead: () => mocks.active,
  useWrite: (factory: unknown) =>
    String(factory).includes("DELETE")
      ? { trigger: mocks.stop, loading: false }
      : { trigger: mocks.start, loading: false },
}));

vi.mock("./DoctorTerminal", () => ({
  DoctorTerminal: ({ onVerification }: { onVerification: (result: { ready: boolean; message: string }) => void }) => (
    <button type="button" onClick={() => onVerification({ ready: true, message: "Ready" })}>
      Installer terminal
    </button>
  ),
}));

vi.mock("./DoctorProposalPanel", () => ({
  DoctorProposalPanel: ({ proposal }: { proposal: { summary: string } }) => <div>{proposal.summary}</div>,
}));

beforeEach(() => {
  mocks.start.mockReset();
  mocks.stop.mockReset();
  mocks.active.trigger.mockReset();
  mocks.active.data = { ok: true, sessionId: null, toolId: null, proposal: null };
});

afterEach(cleanup);

describe("ToolDoctorPanel", () => {
  it("starts once when opened for a tool without an active Doctor", async () => {
    mocks.start.mockResolvedValue({ data: { ok: true, sessionId: "doctor-1" } });

    render(<ToolDoctorPanel toolId="video-tool" onComplete={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() =>
      expect(mocks.start).toHaveBeenCalledWith({
        body: { toolId: "video-tool", model: "gpt-5.6-sol", effort: "medium" },
      }),
    );
    expect(mocks.start).toHaveBeenCalledOnce();
  });

  it("shows a restored proposal instead of mounting the terminal", () => {
    mocks.active.data = {
      ok: true,
      sessionId: "doctor-1",
      toolId: "video-tool",
      proposal: { summary: "Review these commands", commands: [], createdAt: Date.now() },
    };

    render(<ToolDoctorPanel toolId="video-tool" onComplete={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("Review these commands")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Installer terminal" })).not.toBeInTheDocument();
  });

  it("closes automatically after successful installer verification", async () => {
    mocks.active.data = {
      ok: true,
      sessionId: "doctor-1",
      toolId: "video-tool",
      proposal: null,
    };
    const onComplete = vi.fn();
    render(<ToolDoctorPanel toolId="video-tool" onComplete={onComplete} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Installer terminal" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });
});
