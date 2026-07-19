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
  it("submits one selected .forge file through the typed import action", async () => {
    mocks.trigger.mockResolvedValue({
      data: { ok: true, tool: { id: "video-tool", name: "Video Tool", status: "needs-install" } },
    });
    render(
      <MemoryRouter>
        <ToolArchiveImport />
      </MemoryRouter>,
    );
    const file = new File(["archive"], "video-tool.forge", { type: "application/x-scriptforge-tool" });
    fireEvent.drop(screen.getByTestId("archive-dropzone"), {
      dataTransfer: { items: [{ getAsFile: () => file }], files: [file] },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Import tool" }));

    await waitFor(() => expect(mocks.trigger).toHaveBeenCalledOnce());
    expect(mocks.invalidate).toHaveBeenCalledWith("tools");
  });
});
