import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ForgeCandidateDocument } from "../../server/forge/types";
import { CandidateReview } from "./CandidateReview";

describe("CandidateReview", () => {
  it("keeps the active tester compact without duplicate review controls", () => {
    render(<CandidateReview candidate={candidate()} sessionId="session-1" />);

    expect(screen.getByTitle("Tiny Tool interface preview")).toBeVisible();
    expect(screen.getByRole("button", { name: "Script" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Approve candidate" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/changes/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Tiny Tool")).not.toBeInTheDocument();
    expect(screen.queryByText(/Standalone check passed/)).not.toBeInTheDocument();
    expect(screen.getByText(/Host bridge log/)).toBeVisible();
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
