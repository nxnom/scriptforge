import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ForgePanelDocument } from "../../server/forge/types";
import { PanelFeedbackForm } from "./PanelFeedbackForm";

describe("PanelFeedbackForm", () => {
  it("keeps a required answer blocked and visible until it is filled", async () => {
    const onFeedback = vi.fn(async () => undefined);
    render(
      <PanelFeedbackForm panel={requiredPanel()} onFeedback={onFeedback}>
        <p>Question context</p>
      </PanelFeedbackForm>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve & start" }));
    expect(await screen.findByText("This answer is required.")).toBeVisible();
    expect(onFeedback).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Describe it"), { target: { value: "Use short names" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve & start" }));
    await waitFor(() => expect(onFeedback).toHaveBeenCalledWith(expect.stringContaining("Use short names")));
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
