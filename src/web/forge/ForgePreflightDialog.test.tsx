import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ForgePreflightDialog } from "./ForgePreflightDialog";

vi.mock("../api", () => ({
  useRead: (select: (api: typeof fakeApi) => { path: string }) => {
    const { path } = select(fakeApi);
    return path === "forge/sessions"
      ? {
          data: {
            sessions: [
              {
                sessionId: "d2b4af99-5e48-43bf-8af4-7c700e5405b1",
                name: "Duplicate File Finder",
                status: "interrupted",
                scope: "create",
                toolId: null,
                updatedAt: Date.now(),
                resumable: true,
              },
            ],
          },
          loading: false,
          trigger: vi.fn(),
        }
      : {
          data: { installed: true, authenticated: true, version: "test", authMethod: "ChatGPT" },
          loading: false,
          trigger: vi.fn(),
        };
  },
  useWrite: () => ({ trigger: vi.fn(), loading: false }),
  invalidate: vi.fn(),
}));

describe("ForgePreflightDialog", () => {
  it("defaults to a fresh session and offers saved sessions in the start dialog", () => {
    render(<ForgePreflightDialog dismiss={vi.fn()} onContinue={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Start or resume Forge" })).toBeVisible();
    expect(screen.getByText("Saved session")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start fresh session" })).toBeVisible();
    expect(screen.getByText(/Choose a saved session/)).toBeVisible();
  });

  it("uses update-specific copy for an installed tool", () => {
    render(<ForgePreflightDialog mode="update" toolName="Receipt Renamer" dismiss={vi.fn()} onContinue={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Update Receipt Renamer with Codex" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Start update session" })).toBeVisible();
    expect(screen.queryByText("Start a new forge")).not.toBeInTheDocument();
  });
});

function fakeApi(path: string) {
  const request = { path };
  return { GET: () => request };
}
