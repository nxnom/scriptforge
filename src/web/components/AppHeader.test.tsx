import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";

vi.mock("./ForgeLaunchButton", () => ({ ForgeLaunchButton: () => <button type="button">New tool</button> }));

afterEach(cleanup);

describe("AppHeader", () => {
  it("links to the ScriptForge GitHub repository from the Library header", () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );

    const newTool = screen.getByRole("button", { name: "New tool" });
    const github = screen.getByRole("link", { name: "View ScriptForge on GitHub" });

    expect(github).toHaveAttribute("href", "https://github.com/nxnom/scriptforge");
    expect(github).toHaveAttribute("target", "_blank");
    expect(github.querySelector("svg")).toBeInTheDocument();
    expect(newTool.compareDocumentPosition(github) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
