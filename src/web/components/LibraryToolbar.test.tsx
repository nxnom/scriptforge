import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryToolbar } from "./LibraryToolbar";

afterEach(cleanup);

describe("LibraryToolbar", () => {
  it("groups mobile availability and category filters in one menu", () => {
    const onFilter = vi.fn();
    const onCategory = vi.fn();
    render(
      <LibraryToolbar
        count={7}
        counts={{ all: 7, ready: 5, "needs-install": 2, builtin: 4, imported: 3 }}
        filter="all"
        categories={[
          { name: "Files", count: 4 },
          { name: "Social Media", count: 1 },
        ]}
        category={null}
        sort="recent"
        view="grid"
        onFilter={onFilter}
        onCategory={onCategory}
        onSort={vi.fn()}
        onView={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filter tools" }));

    expect(screen.getByText("Availability")).toBeVisible();
    expect(screen.getByText("Category")).toBeVisible();
    fireEvent.click(screen.getByText("Ready · 5"));
    expect(onFilter).toHaveBeenCalledWith("ready");

    fireEvent.click(screen.getByRole("button", { name: "Filter tools" }));
    fireEvent.click(screen.getByText("Social Media · 1"));
    expect(onCategory).toHaveBeenCalledWith("Social Media");
  });
});
