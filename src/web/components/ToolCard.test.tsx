import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolCard, type ToolSummary } from "./ToolCard";
import { paletteFor } from "./tool-card-palette";

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

  it("uses a category accent with neutral labels and semantic status color", () => {
    renderCard({ ...tool(), origin: "bundled" });

    expect(screen.getByRole("article")).toHaveAttribute("data-palette", paletteFor("Video").name);
    expect(screen.getByText("Video")).toHaveClass("bg-[#2d2d2d]", "text-[#b8b8b8]");
    expect(screen.getByText("Ready")).toHaveClass("bg-[#20382b]");
    expect(screen.getByText("Built-in")).toHaveClass("bg-[#292c3c]", "text-[#aeb7ff]");
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
    categories: ["Video", "Files"],
    icon: "video",
    status: "ready",
    origin: "installed",
  };
}
