import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MermaidBlock } from "./MermaidBlock";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({ svg: '<svg aria-label="Rendered diagram"><text>Flow</text></svg>' })),
  },
}));

describe("MermaidBlock", () => {
  it("renders a dedicated Mermaid diagram block", async () => {
    const { container } = render(<MermaidBlock id="flow" source="flowchart LR; A-->B" caption="Simple flow" />);

    await waitFor(() => expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe("Rendered diagram"));
    expect(container.textContent).toContain("Simple flow");
  });
});
