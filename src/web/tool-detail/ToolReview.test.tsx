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
});
