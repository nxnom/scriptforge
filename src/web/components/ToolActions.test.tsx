import { ConfirmDialog, Dialog } from "@geckoui/geckoui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
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

  it("sends the edited title and refreshes the library", async () => {
    mocks.trigger.mockResolvedValue({ data: { ok: true, tool: { id: "video-tool", name: "Clip Trimmer" } } });
    openDialog("Rename tool");

    expect(screen.getByText("Tool title")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Clip Trimmer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save title" }));

    await waitFor(() =>
      expect(mocks.trigger).toHaveBeenCalledWith({ params: { toolId: "video-tool" }, body: { name: "Clip Trimmer" } }),
    );
    expect(mocks.invalidate).toHaveBeenCalledWith("tools");
  });

  it("clones with a suggested title that the user can change", async () => {
    mocks.trigger.mockResolvedValue({ data: { ok: true, tool: { id: "video-tool-pro", name: "Video Tool Pro" } } });
    openDialog("Clone tool");

    expect(screen.getByText("New tool title")).toBeInTheDocument();
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Video Tool copy");
    fireEvent.change(input, { target: { value: "Video Tool Pro" } });
    fireEvent.click(screen.getByRole("button", { name: "Create clone" }));

    await waitFor(() =>
      expect(mocks.trigger).toHaveBeenCalledWith({
        params: { toolId: "video-tool" },
        body: { name: "Video Tool Pro" },
      }),
    );
    expect(mocks.invalidate).toHaveBeenCalledWith("tools");
  });

  it("keeps the dialog open and shows why the server refused the title", async () => {
    mocks.trigger.mockResolvedValue({ data: { ok: false }, error: { error: "A tool with that name is installed." } });
    openDialog("Rename tool");

    fireEvent.click(screen.getByRole("button", { name: "Save title" }));

    expect(await screen.findByText("A tool with that name is installed.")).toBeInTheDocument();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});

function openDialog(action: string) {
  let content: Parameters<typeof Dialog.show>[0]["content"] | undefined;
  vi.spyOn(Dialog, "show").mockImplementation((value) => {
    content = value.content;
    return "dialog-id";
  });
  render(
    <MemoryRouter>
      <ToolActions toolId="video-tool" toolName="Video Tool" />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: action }));
  if (typeof content !== "function") throw new Error(`${action} did not open a dialog.`);
  render(<MemoryRouter>{content({ dismiss: vi.fn() } as never) as ReactNode}</MemoryRouter>);
}
