import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ForgeCandidateDocument } from "../../server/forge/types";
import { CandidateReview } from "./CandidateReview";

describe("CandidateReview", () => {
  it("shows a passive preview without duplicate feedback controls", () => {
    render(<CandidateReview candidate={candidate()} />);

    expect(screen.getByTitle("Tiny Tool interface preview")).toBeVisible();
    expect(screen.getByRole("button", { name: "Script" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Approve candidate" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/changes/i)).not.toBeInTheDocument();
    expect(screen.getByText("Standalone check passed: Processed a realistic sample.")).toBeVisible();
    expect(screen.getByText(/No extra apps needed.*Ask for changes in the terminal/)).toBeVisible();
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
