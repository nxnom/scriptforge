import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolReview } from "./ToolReview";

vi.mock("../api", () => ({
  useRead: () => ({
    loading: false,
    data: { ok: true, scriptSource: 'console.log("runner")', manifestSource: '{"id":"sample-tool"}' },
  }),
}));

afterEach(cleanup);

describe("ToolReview", () => {
  it("keeps blocked preview hidden while exposing read-only script and manifest source", () => {
    const iframeRef = createRef<HTMLIFrameElement>();
    render(
      <ToolReview
        toolId="sample-tool"
        toolName="Sample Tool"
        toolReady={false}
        listening={false}
        configurationLoading={false}
        iframeRef={iframeRef}
        requirements={[{ name: "ffmpeg", detectedVersion: null, reason: "missing" }]}
        retryRequirements={vi.fn()}
        launchDoctor={vi.fn()}
      />,
    );

    expect(screen.queryByTitle("Sample Tool interface")).not.toBeInTheDocument();
    expect(screen.getByText("Missing requirement")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Script" }));
    expect(
      screen.getByText((_text, node) => node?.tagName === "CODE" && node.textContent === 'console.log("runner")'),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(
      screen.getByText((_text, node) => node?.tagName === "CODE" && node.textContent === '{"id":"sample-tool"}'),
    ).toBeVisible();
  });

  it("keeps the preview iframe mounted while source tabs are open", () => {
    const iframeRef = createRef<HTMLIFrameElement>();
    render(
      <ToolReview
        toolId="sample-tool"
        toolName="Sample Tool"
        toolReady
        listening
        configurationLoading={false}
        iframeRef={iframeRef}
        requirements={[]}
        retryRequirements={vi.fn()}
        launchDoctor={vi.fn()}
      />,
    );

    const preview = screen.getByTitle("Sample Tool interface");
    expect(preview).toHaveAttribute("allow", "clipboard-read; clipboard-write");
    expect(preview).toHaveAttribute("sandbox", "allow-downloads allow-forms allow-modals allow-scripts");
    expect(screen.getByRole("button", { name: "Reload preview" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Script" }));
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveClass("hidden");
    expect(screen.queryByRole("button", { name: "Reload preview" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByTitle("Sample Tool interface")).toBe(preview);
  });

  it("reloads the installed tool preview iframe", () => {
    const iframeRef = createRef<HTMLIFrameElement>();
    render(
      <ToolReview
        toolId="sample-tool"
        toolName="Sample Tool"
        toolReady
        listening
        configurationLoading={false}
        iframeRef={iframeRef}
        requirements={[]}
        retryRequirements={vi.fn()}
        launchDoctor={vi.fn()}
      />,
    );
    const preview = screen.getByTitle("Sample Tool interface");

    fireEvent.click(screen.getByRole("button", { name: "Reload preview" }));

    expect(screen.getByTitle("Sample Tool interface")).not.toBe(preview);
  });
});
