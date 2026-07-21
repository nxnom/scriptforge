import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("lets the user request changes from a question-only plan", async () => {
    const onFeedback = vi.fn(async () => undefined);
    render(
      <PanelFeedbackForm panel={requiredPanel()} onFeedback={onFeedback}>
        <p>Question context</p>
      </PanelFeedbackForm>,
    );

    expect(screen.getByRole("button", { name: "Request changes" })).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText("Add feedback (required when requesting changes)"), {
      target: { value: "Use the original file names" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));

    await waitFor(() =>
      expect(onFeedback).toHaveBeenCalledWith(
        expect.stringContaining("**Not approved. Revise the proposal.**\n\nUse the original file names"),
      ),
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

  it("preselects recommended checkbox defaults and includes them in the response", async () => {
    const onFeedback = vi.fn(async () => undefined);
    render(
      <PanelFeedbackForm panel={currencyPanel()} onFeedback={onFeedback}>
        <p>Choose supported currencies</p>
      </PanelFeedbackForm>,
    );

    expect(screen.getByRole("checkbox", { name: /USD/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /THB/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /EUR/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Approve, build & check" }));

    await waitFor(() => expect(onFeedback).toHaveBeenCalledWith(expect.stringContaining("USD, THB")));
  });

  it("makes each visual preview card the design selector", async () => {
    const onFeedback = vi.fn(async () => undefined);
    render(
      <PanelFeedbackForm panel={designPanel()} onFeedback={onFeedback}>
        <p>Choose a direction</p>
      </PanelFeedbackForm>,
    );

    const chooser = screen.getByTitle("Which direction should I build? choices") as HTMLIFrameElement;
    expect(chooser).toHaveAttribute("sandbox", "allow-scripts");
    expect(chooser.srcdoc).toContain('data-scriptforge-value="default"');
    expect(screen.getByText("Selected: ScriptForge dark")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: chooser.contentWindow,
          data: { source: "scriptforge-visual-choice", type: "resize", name: "design", height: 112 },
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          source: chooser.contentWindow,
          data: { source: "scriptforge-visual-choice", type: "select", name: "design", value: "warm" },
        }),
      );
    });
    expect(chooser).toHaveStyle({ height: "112px" });
    expect(screen.getByText("Selected: Warm studio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve, build & check" }));

    await waitFor(() => expect(onFeedback).toHaveBeenCalledWith(expect.stringContaining("warm")));
  });

  it("submits an approved panel only once when the button is clicked repeatedly", async () => {
    const onFeedback = vi.fn(() => new Promise<void>(() => undefined));
    render(
      <PanelFeedbackForm panel={kickoffPanel()} onFeedback={onFeedback}>
        <p>A simple proposal</p>
      </PanelFeedbackForm>,
    );

    const approve = screen.getByRole("button", { name: "Approve, build & check" });
    fireEvent.click(approve);
    fireEvent.click(approve);
    fireEvent.click(approve);

    await waitFor(() => expect(onFeedback).toHaveBeenCalledOnce());
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

function currencyPanel(): ForgePanelDocument {
  return {
    title: "Live BTC price",
    version: 1,
    createdAt: Date.now(),
    blocks: [
      {
        id: "currencies",
        type: "question",
        prompt: "Which currencies should be available?",
        input: {
          kind: "multi_choice",
          name: "currencies",
          required: true,
          options: [
            { value: "USD", label: "USD" },
            { value: "THB", label: "THB" },
            { value: "EUR", label: "EUR" },
          ],
          defaultValue: ["USD", "THB"],
        },
      },
    ],
  };
}

function designPanel(): ForgePanelDocument {
  return {
    title: "Choose a design",
    version: 1,
    createdAt: Date.now(),
    blocks: [
      {
        id: "design",
        type: "question",
        prompt: "Which direction should I build?",
        input: {
          kind: "visual_choice",
          name: "design",
          required: true,
          options: [
            {
              value: "default",
              label: "ScriptForge dark",
              description: "Compact and familiar",
            },
            {
              value: "warm",
              label: "Warm studio",
              description: "A warmer workspace",
            },
          ],
          body: `
            <style>
              .choices { display: flex; gap: 24px; }
              [data-scriptforge-selected] { outline: 2px solid #5468ff; }
            </style>
            <div class="choices">
              <button data-scriptforge-value="default">Dark dashboard</button>
              <button data-scriptforge-value="warm">Warm workspace</button>
            </div>
            <script>window.addEventListener("scriptforge:selection", () => {});</script>
          `,
          defaultValue: "default",
        },
      },
    ],
  };
}
