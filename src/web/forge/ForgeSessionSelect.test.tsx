import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForgeSessionSelect } from "./ForgeSessionSelect";

const mocks = vi.hoisted(() => ({ trigger: vi.fn(), invalidate: vi.fn(), closeMenu: vi.fn() }));

vi.mock("@geckoui/geckoui", () => ({
  Label: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  RHFError: () => null,
  RHFSelect: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectOption: ({ children }: { children: ReactNode | ((args: { closeMenu: () => void }) => ReactNode) }) => (
    <div>{typeof children === "function" ? children({ closeMenu: mocks.closeMenu }) : children}</div>
  ),
  Button: ({
    size: _size,
    variant: _variant,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: string; variant?: string }) => <button {...props} />,
  LoadingButton: ({
    loading: _loading,
    size: _size,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; size?: string }) => <button {...props} />,
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../api", () => ({
  useRead: () => ({
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
  }),
  useWrite: () => ({ trigger: mocks.trigger, loading: false }),
  invalidate: mocks.invalidate,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ForgeSessionSelect", () => {
  it("confirms deletion inline without replacing the start dialog", async () => {
    mocks.trigger.mockResolvedValue({ data: { ok: true } });
    render(<TestForm />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Duplicate File Finder" }));
    expect(screen.getByText(/permanently removed/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Keep" })).toBeVisible();
    expect(mocks.trigger).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete session" }));
    await waitFor(() =>
      expect(mocks.trigger).toHaveBeenCalledWith({
        params: { sessionId: "d2b4af99-5e48-43bf-8af4-7c700e5405b1" },
      }),
    );
    expect(mocks.invalidate).toHaveBeenCalledWith("forge/sessions");
  });
});

function TestForm() {
  const methods = useForm({ defaultValues: { resumeSessionId: "" } });
  return (
    <FormProvider {...methods}>
      <ForgeSessionSelect disabled={false} />
    </FormProvider>
  );
}
