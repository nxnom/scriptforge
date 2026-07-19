import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ForgeCandidateDocument } from "../../server/forge/types";
import { CandidateReview } from "./CandidateReview";

describe("CandidateReview", () => {
  it("keeps the active tester compact without duplicate review controls", () => {
    render(<CandidateReview candidate={candidate()} sessionId="session-1" onTestStatusChange={vi.fn()} />);

    const preview = screen.getByTitle("Tiny Tool interface preview");
    expect(preview).toBeVisible();
    expect(preview).toHaveAttribute("allow", "clipboard-write");
    expect(screen.getByRole("button", { name: "Script" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save tool" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve candidate" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/changes/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Tiny Tool")).not.toBeInTheDocument();
    expect(screen.queryByText(/Standalone check passed/)).not.toBeInTheDocument();
    expect(screen.getByText(/Host bridge log/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Script" }));
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveClass("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByTitle("Tiny Tool interface preview")).toBe(preview);
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
