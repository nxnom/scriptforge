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

  it("declares Silicon for the code screenshot studio", () => {
    expect(findBundledTool("code-screenshot-studio")).toMatchObject({
      categories: ["Developer", "Images"],
      requiredExecutables: [{ name: "silicon" }],
      icon: "code-2",
    });
  });
});
