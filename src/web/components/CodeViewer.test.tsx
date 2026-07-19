import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CodeViewer } from "./CodeViewer";

afterEach(cleanup);

describe("CodeViewer", () => {
  it("shows line numbers and highlights JavaScript tokens without injecting markup", () => {
    render(<CodeViewer filename="run.mjs" language="javascript" source={'const value = "<script>";\nreturn value;'} />);

    expect(screen.getByText("run.mjs")).toBeVisible();
    expect(screen.getByText("1")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
    expect(screen.getByText("const")).toHaveClass("text-[#c792ea]");
    expect(screen.getByText('"<script>"')).toHaveClass("text-[#c3e88d]");
    expect(document.querySelector("script")).not.toBeInTheDocument();
  });

  it("distinguishes JSON keys from values", () => {
    render(<CodeViewer filename="tool.json" language="json" source={'{"name":"Tiny Tool","ready":true}'} />);

    expect(screen.getByText('"name"')).toHaveClass("text-[#82aaff]");
    expect(screen.getByText('"Tiny Tool"')).toHaveClass("text-[#c3e88d]");
    expect(screen.getByText("true")).toHaveClass("text-[#ffcb6b]");
  });
});
