import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolUpdateWorkspace } from "./ToolUpdateWorkspace";

vi.mock("../forge/ForgeTerminal", () => ({
  ForgeTerminal: () => <div>Codex terminal</div>,
}));
vi.mock("../forge/ForgeSidePanel", () => ({
  ForgeSidePanel: () => <div>Plan panel</div>,
}));
vi.mock("../forge/CandidateReview", () => ({
  CandidateReview: () => <div>Candidate review</div>,
}));

afterEach(cleanup);

describe("ToolUpdateWorkspace", () => {
  it("replaces the terminal with a blocking plan panel", () => {
    render(
      <ToolUpdateWorkspace
        sessionId="session-1"
        panel={{
          title: "Choose an update",
          version: 1,
          createdAt: Date.now(),
          blocks: [
            {
              id: "question",
              type: "question",
              prompt: "Which layout?",
              input: { kind: "text", name: "layout", required: true },
            },
          ],
        }}
        candidate={null}
        installedReview={<div>Installed tool</div>}
        onSessionEnd={vi.fn()}
        onPanel={vi.fn()}
        onCandidate={vi.fn()}
      />,
    );

    expect(screen.getByText("Plan panel")).toBeVisible();
    expect(screen.queryByText("Codex terminal")).not.toBeInTheDocument();
    expect(screen.queryByText("Installed tool")).not.toBeInTheDocument();
  });
});
