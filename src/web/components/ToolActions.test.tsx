import { ConfirmDialog } from "@geckoui/geckoui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolActions } from "./ToolActions";

const mocks = vi.hoisted(() => ({ trigger: vi.fn(), invalidate: vi.fn() }));

vi.mock("../api", () => ({
  useWrite: () => ({ trigger: mocks.trigger }),
  invalidate: mocks.invalidate,
}));

beforeEach(() => {
  mocks.trigger.mockReset();
  mocks.invalidate.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ToolActions", () => {
  it("waits for confirmation before deleting the installed tool", async () => {
    let options: Parameters<typeof ConfirmDialog.show>[0] | undefined;
    vi.spyOn(ConfirmDialog, "show").mockImplementation((value) => {
      options = value;
    });
    mocks.trigger.mockResolvedValue({ data: { ok: true } });
    render(
      <MemoryRouter>
        <ToolActions toolId="video-tool" toolName="Video Tool" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(mocks.trigger).not.toHaveBeenCalled();
    const dismiss = vi.fn();
    const preventDefault = vi.fn();
    await options?.onConfirm?.({ ...options, dismiss, preventDefault });

    await waitFor(() => expect(mocks.trigger).toHaveBeenCalledWith({ params: { toolId: "video-tool" } }));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledOnce();
    expect(mocks.invalidate).toHaveBeenCalledWith("tools");
  });
});
