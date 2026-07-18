import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ForgePanelDocument } from "../../server/forge/types";
import { PanelFeedbackForm } from "./PanelFeedbackForm";

afterEach(cleanup);

describe("PanelFeedbackForm", () => {
  it("keeps a required answer blocked and visible until it is filled", async () => {
    const onFeedback = vi.fn(async () => undefined);
    render(
      <PanelFeedbackForm panel={requiredPanel()} onFeedback={onFeedback}>
        <p>Question context</p>
      </PanelFeedbackForm>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve, build & check" }));
    expect(await screen.findByText("This answer is required.")).toBeVisible();
    expect(onFeedback).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Describe it"), { target: { value: "Use short names" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve, build & check" }));
    await waitFor(() =>
      expect(onFeedback).toHaveBeenCalledWith(expect.stringContaining("Build and run the standalone check now")),
    );
  });

  it("requires feedback before requesting kickoff changes", async () => {
    const onFeedback = vi.fn(async () => undefined);
    render(
      <PanelFeedbackForm panel={kickoffPanel()} onFeedback={onFeedback}>
        <p>A simple proposal</p>
      </PanelFeedbackForm>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));
    expect(await screen.findByText("Tell Codex what you want changed.")).toBeVisible();
    expect(onFeedback).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Add feedback (required when requesting changes)"), {
      target: { value: "Make the chart optional" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));
    await waitFor(() => expect(onFeedback).toHaveBeenCalledWith(expect.stringContaining("Make the chart optional")));
  });
});

function requiredPanel(): ForgePanelDocument {
  return {
    title: "One detail",
    version: 1,
    createdAt: Date.now(),
    blocks: [
      {
        id: "naming",
        type: "question",
        prompt: "How should files be named?",
        input: { kind: "text", name: "naming", required: true, placeholder: "Describe it" },
      },
    ],
  };
}

function kickoffPanel(): ForgePanelDocument {
  return {
    title: "Ready to forge",
    version: 1,
    createdAt: Date.now(),
    blocks: [
      {
        id: "approval",
        type: "approval",
        title: "Create this tool?",
        description: "It will show the latest price and a small chart.",
        approveLabel: "Approve, build & check",
        rejectLabel: "Request changes",
      },
    ],
  };
}
