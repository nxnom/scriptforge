import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ForgePanelDocument } from "../../server/forge/types";
import { ForgeSidePanel } from "./ForgeSidePanel";

const mocks = vi.hoisted(() => ({ trigger: vi.fn() }));

vi.mock("../api", () => ({
  useWrite: () => ({ trigger: mocks.trigger }),
}));

beforeEach(() => {
  mocks.trigger.mockReset();
});

afterEach(cleanup);

describe("ForgeSidePanel", () => {
  it("dismisses immediately while feedback is still being sent", async () => {
    const order: string[] = [];
    let finishRequest: ((value: { data: { ok: true } }) => void) | undefined;
    mocks.trigger.mockImplementation(
      () =>
        new Promise((resolve) => {
          order.push("request");
          finishRequest = resolve;
        }),
    );
    const onResolved = vi.fn(() => order.push("dismiss"));
    const onSubmissionError = vi.fn();

    render(
      <ForgeSidePanel
        sessionId="session-1"
        panel={panel()}
        onResolved={onResolved}
        onSubmissionError={onSubmissionError}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve, build & check" }));

    await waitFor(() => expect(mocks.trigger).toHaveBeenCalledOnce());
    expect(onResolved).toHaveBeenCalledOnce();
    expect(order).toEqual(["dismiss", "request"]);
    expect(mocks.trigger).toHaveBeenCalledWith({
      params: { sessionId: "session-1" },
      body: { text: expect.any(String), dismiss: true, panelVersion: 1 },
    });
    expect(onSubmissionError).not.toHaveBeenCalled();

    finishRequest?.({ data: { ok: true } });
  });

  it("dismisses a requested revision before its feedback request finishes", async () => {
    mocks.trigger.mockReturnValue(new Promise(() => undefined));
    const onResolved = vi.fn();

    render(
      <ForgeSidePanel sessionId="session-1" panel={panel()} onResolved={onResolved} onSubmissionError={vi.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText("Add feedback (required when requesting changes)"), {
      target: { value: "Use a simpler chart" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));

    await waitFor(() => expect(mocks.trigger).toHaveBeenCalledOnce());
    expect(onResolved).toHaveBeenCalledOnce();
  });
});

function panel(): ForgePanelDocument {
  return {
    title: "Ready to forge",
    version: 1,
    createdAt: Date.now(),
    blocks: [
      {
        id: "approval",
        type: "approval",
        title: "Create this tool?",
        description: "Build and check the local tool.",
        approveLabel: "Approve, build & check",
        rejectLabel: "Request changes",
      },
    ],
  };
}
