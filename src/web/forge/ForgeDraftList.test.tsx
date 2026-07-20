import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForgeDraftList } from "./ForgeDraftList";

afterEach(cleanup);

describe("ForgeDraftList", () => {
  it("offers resumable stopped and interrupted sessions", () => {
    const resume = vi.fn();
    const discard = vi.fn();
    const draft = {
      sessionId: "d2b4af99-5e48-43bf-8af4-7c700e5405b1",
      name: "Duplicate File Finder",
      status: "interrupted" as const,
      scope: "create" as const,
      toolId: null,
      updatedAt: Date.now(),
      resumable: true,
    };
    render(<ForgeDraftList drafts={[draft]} loading={false} onResume={resume} onDiscard={discard} />);

    expect(screen.getByText("Duplicate File Finder")).toBeVisible();
    expect(screen.getByText(/Interrupted/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(resume).toHaveBeenCalledWith(draft);
    fireEvent.click(screen.getByRole("button", { name: "Discard Duplicate File Finder" }));
    expect(discard).toHaveBeenCalledWith(draft);
  });
});
