import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ConfigurationFieldStatus, ToolConfigurationForm } from "./ToolConfigurationForm";

afterEach(cleanup);

describe("ToolConfigurationForm", () => {
  it("validates and submits generated fields", async () => {
    const save = vi.fn(async () => undefined);
    render(<ToolConfigurationForm fields={fields()} saving={false} onSave={save} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
    expect(await screen.findByText("Username is required.")).toBeVisible();
    expect(await screen.findByText("Access token is required.")).toBeVisible();

    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: "maya" } });
    fireEvent.change(screen.getByLabelText(/Access token/), { target: { value: "private-token" } });
    fireEvent.change(screen.getByLabelText(/Port/), { target: { value: "1025" } });
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        values: { username: "maya", accessToken: "private-token", notifications: true, port: 1025 },
        clearSecrets: [],
      }),
    );
  });

  it("does not require re-entering a configured secret and can explicitly remove it", async () => {
    const save = vi.fn(async () => undefined);
    const configured = fields().map((field) => (field.key === "accessToken" ? { ...field, configured: true } : field));
    render(<ToolConfigurationForm fields={configured} saving={false} onSave={save} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/Access token/)).toHaveAttribute("placeholder", "Saved — leave blank to keep it");
    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: "maya" } });
    fireEvent.click(screen.getByLabelText("Remove saved value"));
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ clearSecrets: ["accessToken"] })));
  });
});

function fields(): ConfigurationFieldStatus[] {
  return [
    { key: "username", label: "Username", type: "text", required: true, configured: false },
    { key: "accessToken", label: "Access token", type: "secret", required: true, configured: false },
    {
      key: "notifications",
      label: "Notifications",
      type: "boolean",
      required: false,
      defaultValue: true,
      configured: true,
      value: true,
    },
    {
      key: "port",
      label: "Port",
      type: "number",
      required: true,
      minimum: 1,
      maximum: 65535,
      defaultValue: 587,
      configured: true,
      value: 587,
    },
  ];
}
