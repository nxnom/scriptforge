import { cleanup, render, screen, within } from "@testing-library/react";
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

    const categoryList = screen.getByRole("navigation", { name: "Tool categories" });
    expect(categoryList).toHaveClass(
      "min-h-0",
      "flex-1",
      "overflow-y-auto",
      "overscroll-contain",
      "[scrollbar-width:none]",
      "[&::-webkit-scrollbar]:hidden",
    );
    expect(within(categoryList).getByRole("button", { name: /All categories/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Category 20/ })).toBeInTheDocument();
  });
});
