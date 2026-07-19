import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ForgePreflightDialog } from "./ForgePreflightDialog";

vi.mock("../api", () => ({
  useRead: () => ({
    data: { installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" },
    loading: false,
    trigger: vi.fn(),
  }),
}));

describe("ForgePreflightDialog", () => {
  it("uses update-specific copy for an installed tool", () => {
    render(<ForgePreflightDialog mode="update" toolName="Receipt Renamer" dismiss={vi.fn()} onContinue={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Update Receipt Renamer with Codex" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Start update session" })).toBeVisible();
    expect(screen.queryByText("Start a new forge")).not.toBeInTheDocument();
  });
});
