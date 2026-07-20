import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolUpdateActions } from "./ToolUpdateActions";

const handlers = { start: vi.fn(), stop: vi.fn(), save: vi.fn() };

describe("ToolUpdateActions", () => {
  it("offers Update only for installed tools", () => {
    const { rerender } = render(<ToolUpdateActions {...handlers} {...state} installed />);
    expect(screen.getByRole("button", { name: "Update tool" })).toBeVisible();

    rerender(<ToolUpdateActions {...handlers} {...state} installed={false} />);
    expect(screen.queryByRole("button", { name: "Update tool" })).not.toBeInTheDocument();
  });

  it("uses Save changes and hides it after the candidate is saved", () => {
    const { rerender } = render(
      <ToolUpdateActions
        {...handlers}
        {...state}
        installed
        sessionActive
        candidateReady
        candidateTested
        candidateSaved={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Update tool" })).not.toBeInTheDocument();

    rerender(
      <ToolUpdateActions
        {...handlers}
        {...state}
        installed
        sessionActive
        candidateReady
        candidateTested
        candidateSaved
      />,
    );
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });
});

const state = {
  sessionActive: false,
  candidateReady: false,
  candidateTested: false,
  candidateSaved: false,
  stopping: false,
  saving: false,
};
