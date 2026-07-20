import { ConfirmDialog } from "@geckoui/geckoui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolActions } from "./ToolActions";

const mocks = vi.hoisted(() => ({ trigger: vi.fn() }));

vi.mock("../api", () => ({
  useWrite: () => ({ trigger: mocks.trigger }),
}));

beforeEach(() => {
  mocks.trigger.mockReset();
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

    fireEvent.click(screen.getByRole("button", { name: "Delete tool" }));
    expect(mocks.trigger).not.toHaveBeenCalled();
    const dismiss = vi.fn();
    const preventDefault = vi.fn();
    await options?.onConfirm?.({ ...options, dismiss, preventDefault });

    await waitFor(() =>
      expect(mocks.trigger).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { toolId: "video-tool" },
          optimistic: expect.any(Function),
        }),
      ),
    );
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledOnce();

    const optimistic = mocks.trigger.mock.calls[0]?.[0].optimistic;
    const set = vi.fn();
    const cache = vi.fn(() => ({ set }));
    optimistic(cache);
    expect(cache).toHaveBeenCalledWith("tools");
    const update = set.mock.calls[0]?.[0];
    expect(update({ tools: [{ id: "video-tool" }, { id: "keep-this-tool" }] })).toEqual({
      tools: [{ id: "keep-this-tool" }],
    });
  });
});
