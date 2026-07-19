import { describe, expect, it } from "vitest";
import { toolManifestSchema } from "./manifest";

describe("tool manifest categories", () => {
  it("normalizes a legacy installed-tool category", () => {
    expect(toolManifestSchema.parse(manifest({ category: "Images" })).categories).toEqual(["Images"]);
  });

  it("accepts at most three unique categories", () => {
    expect(toolManifestSchema.parse(manifest({ categories: ["Images", "Files"] })).categories).toEqual([
      "Images",
      "Files",
    ]);
    expect(() => toolManifestSchema.parse(manifest({ categories: ["One", "Two", "Three", "Four"] }))).toThrow();
    expect(() => toolManifestSchema.parse(manifest({ categories: ["Files", "files"] }))).toThrow();
  });
});

function manifest(categories: { category: string } | { categories: string[] }) {
  return {
    schemaVersion: 1,
    id: "sample-tool",
    version: "1.0.0",
    name: "Sample Tool",
    description: "A sample tool.",
    icon: "file",
    script: "run.mjs",
    interface: { type: "html", entry: "ui.html" },
    requiredExecutables: [],
    ...categories,
  };
}
