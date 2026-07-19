import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToolInfoSidebar } from "./ToolInfoSidebar";

afterEach(cleanup);

describe("ToolInfoSidebar", () => {
  it("shows identity, runtime, version, and dependency state", () => {
    render(
      <ToolInfoSidebar
        tool={{
          id: "image-resizer",
          version: "1.0.0",
          name: "Image Resizer",
          description: "Resize images locally.",
          categories: ["Images", "Files"],
          icon: "image",
          status: "ready",
          origin: "bundled",
          execution: "local",
          runtime: "Node.js",
        }}
        requirements={[]}
      />,
    );

    const heading = screen.getByRole("heading", { name: "Image Resizer" });
    expect(heading).toBeVisible();
    expect(heading.closest("section")).toHaveAttribute("data-palette");
    expect(screen.getAllByText("Built-in")).toHaveLength(2);
    expect(screen.getAllByText("Built-in")[0]).toHaveClass("bg-[#252a48]", "text-[#aeb7ff]");
    expect(screen.getByText("Images")).toHaveClass("ring-inset");
    expect(screen.getByText("1.0.0")).toBeVisible();
    expect(screen.getByText("Node.js")).toBeVisible();
    expect(screen.getByText("None required")).toBeVisible();
  });

  it("surfaces missing executable requirements", () => {
    render(
      <ToolInfoSidebar
        tool={{
          id: "video-tool",
          version: "2.0.0",
          name: "Video Tool",
          description: "Convert a video.",
          categories: ["Video"],
          icon: "wrench",
          status: "needs-install",
          origin: "installed",
          execution: "local",
          runtime: "Node.js",
        }}
        requirements={[{ name: "ffmpeg", detectedVersion: null, reason: "missing" }]}
      />,
    );

    expect(screen.getByText("Saved tool")).toBeVisible();
    expect(screen.getByText("ffmpeg")).toBeVisible();
    expect(screen.getByText("Needs install")).toBeVisible();
  });
});
