import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryRail } from "./LibraryRail";

afterEach(cleanup);

describe("LibraryRail", () => {
  it("keeps a long category list inside its own scroll region", () => {
    render(
      <LibraryRail
        counts={{ all: 12, ready: 10, "needs-install": 2, builtin: 8, imported: 4 }}
        filter="all"
        categories={Array.from({ length: 20 }, (_, index) => ({ name: `Category ${index + 1}`, count: index + 1 }))}
        category={null}
        onFilter={vi.fn()}
        onCategory={vi.fn()}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Tool categories" })).toHaveClass(
      "min-h-0",
      "flex-1",
      "overflow-y-auto",
      "overscroll-contain",
    );
    expect(screen.getByRole("button", { name: /All categories/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Category 20/ })).toBeInTheDocument();
  });
});
