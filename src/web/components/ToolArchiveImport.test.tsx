import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolArchiveImport } from "./ToolArchiveImport";

const mocks = vi.hoisted(() => ({ trigger: vi.fn(), invalidate: vi.fn() }));

vi.mock("../api", () => ({
  useWrite: () => ({ trigger: mocks.trigger, loading: false }),
  invalidate: mocks.invalidate,
}));

beforeEach(() => {
  mocks.trigger.mockReset();
  mocks.invalidate.mockReset();
});

afterEach(cleanup);

describe("ToolArchiveImport", () => {
  it("does not show an error when the file picker is cancelled", async () => {
    render(
      <MemoryRouter>
        <ToolArchiveImport />
      </MemoryRouter>,
    );

    fireEvent.drop(screen.getByTestId("archive-dropzone"), {
      dataTransfer: { items: [], files: [] },
    });

    await waitFor(() => expect(screen.queryByText(/Choose one \.forge file/i)).not.toBeInTheDocument());
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it("imports a dropped .forge file immediately through the typed action", async () => {
    mocks.trigger.mockResolvedValue({
      data: { ok: true, tool: { id: "video-tool", name: "Video Tool", status: "needs-install" } },
    });
    render(
      <MemoryRouter>
        <ToolArchiveImport />
      </MemoryRouter>,
    );
    expect(screen.getByText("Add tools from .forge files")).toBeVisible();
    expect(screen.getByText(/Choose or drop one or more archives/)).toBeVisible();
    expect(screen.queryByText("Import a shared .forge tool")).not.toBeInTheDocument();
    const file = new File(["archive"], "video-tool.forge", { type: "application/x-scriptforge-tool" });
    fireEvent.drop(screen.getByTestId("archive-dropzone"), {
      dataTransfer: { items: [{ getAsFile: () => file }], files: [file] },
    });

    await waitFor(() => expect(mocks.trigger).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button", { name: "Import tool" })).not.toBeInTheDocument();
    expect(mocks.invalidate).toHaveBeenCalledWith("tools");
    await waitFor(() => expect(screen.getByText("Add tools from .forge files")).toBeVisible());
  });

  it("imports every archive from one multi-file drop", async () => {
    mocks.trigger
      .mockResolvedValueOnce({
        data: { ok: true, tool: { id: "colors", name: "Color Mixer", status: "ready" } },
      })
      .mockResolvedValueOnce({
        data: { ok: true, tool: { id: "dates", name: "Date Calculator", status: "needs-config" } },
      });
    render(
      <MemoryRouter>
        <ToolArchiveImport />
      </MemoryRouter>,
    );
    const colorTool = new File(["colors"], "colors.forge", { type: "application/x-scriptforge-tool" });
    const dateTool = new File(["dates"], "dates.forge", { type: "application/x-scriptforge-tool" });

    fireEvent.drop(screen.getByTestId("archive-dropzone"), {
      dataTransfer: {
        items: [{ getAsFile: () => colorTool }, { getAsFile: () => dateTool }],
        files: [colorTool, dateTool],
      },
    });

    await waitFor(() => expect(mocks.trigger).toHaveBeenCalledTimes(2));
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    expect(mocks.invalidate).toHaveBeenCalledWith("tools");
    await waitFor(() => expect(screen.getByText("Add tools from .forge files")).toBeVisible());
  });

  it("continues importing the remaining archives after one fails", async () => {
    mocks.trigger.mockResolvedValueOnce({ error: { error: "That archive is invalid." } }).mockResolvedValueOnce({
      data: { ok: true, tool: { id: "dates", name: "Date Calculator", status: "ready" } },
    });
    render(
      <MemoryRouter>
        <ToolArchiveImport />
      </MemoryRouter>,
    );
    const brokenTool = new File(["broken"], "broken.forge", { type: "application/x-scriptforge-tool" });
    const dateTool = new File(["dates"], "dates.forge", { type: "application/x-scriptforge-tool" });

    fireEvent.drop(screen.getByTestId("archive-dropzone"), {
      dataTransfer: {
        items: [{ getAsFile: () => brokenTool }, { getAsFile: () => dateTool }],
        files: [brokenTool, dateTool],
      },
    });

    await waitFor(() => expect(mocks.trigger).toHaveBeenCalledTimes(2));
    expect(mocks.invalidate).toHaveBeenCalledWith("tools");
  });
});
