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

  it("imports a selected .forge file immediately through the typed action", async () => {
    mocks.trigger.mockResolvedValue({
      data: { ok: true, tool: { id: "video-tool", name: "Video Tool", status: "needs-install" } },
    });
    render(
      <MemoryRouter>
        <ToolArchiveImport />
      </MemoryRouter>,
    );
    expect(screen.getByText("Add a tool from a .forge file")).toBeVisible();
    expect(screen.getByText(/Nothing runs during import/)).toBeVisible();
    expect(screen.queryByText("Import a shared .forge tool")).not.toBeInTheDocument();
    const file = new File(["archive"], "video-tool.forge", { type: "application/x-scriptforge-tool" });
    fireEvent.drop(screen.getByTestId("archive-dropzone"), {
      dataTransfer: { items: [{ getAsFile: () => file }], files: [file] },
    });

    await waitFor(() => expect(mocks.trigger).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button", { name: "Import tool" })).not.toBeInTheDocument();
    expect(mocks.invalidate).toHaveBeenCalledWith("tools");
  });
});
