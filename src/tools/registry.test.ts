import { describe, expect, it } from "vitest";
import { findBundledTool, listBundledTools } from "./registry";

describe("bundled tool registry", () => {
  it("loads valid manifests without exposing mutable registry state", () => {
    const tools = listBundledTools();
    const firstTool = tools.at(0);
    expect(firstTool).toBeDefined();
    if (firstTool) firstTool.name = "Changed";

    expect(findBundledTool("image-resizer")).toMatchObject({
      name: "Image Resizer",
      categories: ["Images", "Files"],
      requiredExecutables: [],
      script: "run.mjs",
      interface: { type: "html", entry: "ui.html" },
    });
  });

  it("returns undefined for unknown tools", () => {
    expect(findBundledTool("missing")).toBeUndefined();
  });

  it("includes the zero-install PDF toolkit", () => {
    expect(findBundledTool("pdf-toolkit")).toMatchObject({
      categories: ["PDF", "Documents"],
      requiredExecutables: [],
      script: "run.mjs",
      interface: { type: "html", entry: "ui.html" },
    });
  });

  it("includes the zero-install app icon exporter", () => {
    expect(findBundledTool("app-icon-exporter")).toMatchObject({
      categories: ["Images", "Developer"],
      requiredExecutables: [],
      icon: "app-window",
    });
  });

  it("includes the zero-install favicon creator", () => {
    expect(findBundledTool("favicon-creator")).toMatchObject({
      categories: ["Images", "Developer"],
      requiredExecutables: [],
      icon: "globe-2",
    });
  });

  it("includes the FFmpeg media toolkit", () => {
    expect(findBundledTool("media-toolkit")).toMatchObject({
      categories: ["Video", "Audio"],
      requiredExecutables: [{ name: "ffmpeg" }],
      icon: "clapperboard",
    });
  });

  it("declares Silicon for the code screenshot studio", () => {
    expect(findBundledTool("code-screenshot-studio")).toMatchObject({
      categories: ["Developer", "Images"],
      requiredExecutables: [{ name: "silicon" }],
      icon: "code-2",
    });
  });

  it("includes the zero-install SMTP campaign sender with encrypted credentials", () => {
    expect(findBundledTool("smtp-campaign-sender")).toMatchObject({
      categories: ["Email", "Productivity"],
      requiredExecutables: [],
      icon: "mail",
      configuration: expect.arrayContaining([
        expect.objectContaining({ key: "smtpPassword", type: "secret", required: true }),
      ]),
    });
  });
});
