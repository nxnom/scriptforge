import { describe, expect, it } from "vitest";
import type { ToolSummary } from "../components/ToolCard";
import { countCategories, getToolActivities, selectTools } from "./LibraryPage";

const tools: ToolSummary[] = [
  {
    id: "image-tool",
    name: "Image Tool",
    description: "Resizes a photo.",
    categories: ["Images", "Files"],
    icon: "image",
    status: "ready",
    origin: "bundled",
  },
  {
    id: "video-tool",
    name: "Video Tool",
    description: "Converts a clip.",
    categories: ["Video", "files"],
    icon: "video",
    status: "needs-install",
    origin: "installed",
  },
];

describe("library categories", () => {
  it("derives category counts case-insensitively from actual tools", () => {
    expect(countCategories(tools)).toEqual([
      { name: "Files", count: 2 },
      { name: "Images", count: 1 },
      { name: "Video", count: 1 },
    ]);
  });

  it("searches and filters across every category", () => {
    expect(selectTools(tools, "video", "all", null, "name").map((tool) => tool.id)).toEqual(["video-tool"]);
    expect(selectTools(tools, "", "all", "Files", "name").map((tool) => tool.id)).toEqual(["image-tool", "video-tool"]);
  });
});

describe("library tool activity", () => {
  it("maps only matching Doctor and update sessions onto a tool", () => {
    const sessions = [
      { scope: "create", toolId: "image-tool" },
      { scope: "update", toolId: "video-tool" },
      { scope: "update", toolId: "another-tool" },
    ];

    expect(getToolActivities("video-tool", "video-tool", sessions)).toEqual(["editing", "doctor"]);
    expect(getToolActivities("image-tool", "another-tool", sessions)).toEqual([]);
  });
});
