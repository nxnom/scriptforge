import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolCard, type ToolSummary } from "./ToolCard";

vi.mock("../api", () => ({
  useWrite: () => ({ trigger: vi.fn() }),
  invalidate: vi.fn(),
}));

afterEach(cleanup);

describe("ToolCard", () => {
  it("opens an available tool from the whole card without an Open button", () => {
    renderCard(tool());
    expect(screen.queryByRole("button", { name: "Open" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link"));

    expect(screen.getByText("Tool detail route")).toBeVisible();
  });

  it("keeps the installed-tool actions trigger separate from card navigation", () => {
    renderCard(tool());

    fireEvent.click(screen.getByRole("button", { name: "Actions for Video Tool" }));

    expect(screen.getByRole("link")).toBeVisible();
    expect(screen.queryByText("Tool detail route")).not.toBeInTheDocument();
  });

  it("does not create a transformed stacking context that can cover its menu", () => {
    renderCard(tool());

    const card = screen.getByRole("article");
    expect(card.className).not.toContain("translate");
    expect(card.className).not.toContain("transform");
  });

  it("uses a horizontal row composition in list view", () => {
    const { container } = renderCard(tool(), "list");

    expect(container.querySelector("article > div")?.className).toContain("grid-cols-[auto_minmax(0,1fr)_auto]");
  });
});

function renderCard(value: ToolSummary, layout: "grid" | "list" = "grid") {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<ToolCard tool={value} layout={layout} />} />
        <Route path="/tools/:toolId" element={<p>Tool detail route</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function tool(): ToolSummary {
  return {
    id: "video-tool",
    name: "Video Tool",
    description: "Converts videos.",
    category: "Video",
    icon: "video",
    status: "ready",
    origin: "installed",
  };
}
