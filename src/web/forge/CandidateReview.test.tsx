import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ForgeCandidateDocument } from "../../server/forge/types";
import { CandidateReview } from "./CandidateReview";

afterEach(cleanup);

describe("CandidateReview", () => {
  it("keeps the active tester compact without duplicate review controls", () => {
    render(<CandidateReview candidate={candidate()} sessionId="session-1" onTestStatusChange={vi.fn()} />);

    const preview = screen.getByTitle("Tiny Tool interface preview");
    expect(preview).toBeVisible();
    expect(preview).not.toHaveAttribute("sandbox");
    expect(preview).toHaveAttribute("allow", expect.stringContaining("clipboard-write *"));
    expect(screen.getByRole("button", { name: "Script" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save tool" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve candidate" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/changes/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Tiny Tool")).not.toBeInTheDocument();
    expect(screen.queryByText(/Standalone check passed/)).not.toBeInTheDocument();
    expect(screen.getByText(/Host bridge log/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Reload preview" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Script" }));
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveClass("hidden");
    expect(screen.queryByRole("button", { name: "Reload preview" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByTitle("Tiny Tool interface preview")).toBe(preview);
  });

  it("reloads the unrestricted preview iframe", () => {
    render(<CandidateReview candidate={candidate()} sessionId="session-1" onTestStatusChange={vi.fn()} />);
    const preview = screen.getByTitle("Tiny Tool interface preview");

    fireEvent.click(screen.getByRole("button", { name: "Reload preview" }));

    expect(screen.getByTitle("Tiny Tool interface preview")).not.toBe(preview);
  });

  it("toggles terminal visibility from the candidate toolbar", () => {
    const onTerminalCollapsedChange = vi.fn();
    const view = render(
      <CandidateReview
        candidate={candidate()}
        sessionId="session-1"
        terminalCollapsed={false}
        onTerminalCollapsedChange={onTerminalCollapsedChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse terminal" }));
    expect(onTerminalCollapsedChange).toHaveBeenCalledWith(true);

    view.rerender(
      <CandidateReview
        candidate={candidate()}
        sessionId="session-1"
        terminalCollapsed
        onTerminalCollapsedChange={onTerminalCollapsedChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Show terminal" })).toBeVisible();
    expect(screen.getByRole("complementary")).toHaveClass("flex-1", "min-w-0");
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
