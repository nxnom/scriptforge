import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolUpdateActions } from "./ToolUpdateActions";

const handlers = { start: vi.fn(), stop: vi.fn(), save: vi.fn() };

describe("ToolUpdateActions", () => {
  it("offers Update only for installed tools", () => {
    const { rerender } = render(<ToolUpdateActions {...handlers} {...state} installed />);
    expect(screen.getByRole("button", { name: "Update" })).toBeVisible();

    rerender(<ToolUpdateActions {...handlers} {...state} installed={false} />);
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument();
  });
});

const state = {
  sessionActive: false,
  candidateReady: false,
  candidateTested: false,
  anotherSessionActive: false,
  stopping: false,
  saving: false,
};
