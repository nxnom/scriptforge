import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ForgeCandidateDocument } from "../../server/forge/types";
import { ForgeSessionWorkspace } from "./ForgeSessionWorkspace";

vi.mock("./ForgeTerminal", () => ({
  ForgeTerminal: () => <div>Codex terminal</div>,
}));
vi.mock("./CandidateReview", () => ({
  CandidateReview: ({ terminalCollapsed, onTerminalCollapsedChange }: CandidateReviewMockProps) => (
    <div>
      Candidate preview
      <button type="button" onClick={() => onTerminalCollapsedChange(!terminalCollapsed)}>
        {terminalCollapsed ? "Show terminal" : "Collapse terminal"}
      </button>
    </div>
  ),
}));

type CandidateReviewMockProps = {
  terminalCollapsed: boolean;
  onTerminalCollapsedChange: (collapsed: boolean) => void;
};

afterEach(cleanup);

describe("ForgeSessionWorkspace", () => {
  it("offers terminal collapse only when a candidate is present", () => {
    const props = {
      sessionId: "session-1",
      onSessionEnd: vi.fn(),
      onPanel: vi.fn(),
      onCandidate: vi.fn(),
    };
    const view = render(<ForgeSessionWorkspace {...props} candidate={null} />);

    expect(screen.getByText("Codex terminal")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Collapse terminal" })).not.toBeInTheDocument();

    view.rerender(<ForgeSessionWorkspace {...props} candidate={candidate()} />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse terminal" }));

    expect(screen.queryByText("Codex terminal")).not.toBeInTheDocument();
    expect(screen.getByText("Candidate preview")).toBeVisible();
    expect(screen.getByRole("button", { name: "Show terminal" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Show terminal" }));
    expect(screen.getByText("Codex terminal")).toBeVisible();
  });

  it("allows an installed-tool fallback to collapse the terminal before a candidate exists", () => {
    render(
      <ForgeSessionWorkspace
        sessionId="session-1"
        candidate={null}
        fallback={({ terminalCollapsed, onTerminalCollapsedChange }) => (
          <div>
            Installed preview
            <button type="button" onClick={() => onTerminalCollapsedChange(!terminalCollapsed)}>
              {terminalCollapsed ? "Show terminal" : "Collapse terminal"}
            </button>
          </div>
        )}
        onSessionEnd={vi.fn()}
        onPanel={vi.fn()}
        onCandidate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse terminal" }));
    expect(screen.queryByText("Codex terminal")).not.toBeInTheDocument();
    expect(screen.getByText("Installed preview")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Show terminal" }));
    expect(screen.getByText("Codex terminal")).toBeVisible();
  });
});

function candidate(): ForgeCandidateDocument {
  return {
    name: "Tiny Tool",
    description: "Does one small thing.",
    summary: "A focused local utility.",
    testSummary: "Processed a realistic sample.",
    requiredExecutables: [],
    manifestSource: "{}",
    scriptSource: "",
    interfaceHtml: "<!doctype html><title>Tiny Tool</title>",
    revision: "abc",
    createdAt: Date.now(),
  };
}
