import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findInstalledTool } from "./installed";
import { listBundledTools } from "./registry";
import { ToolTitleService } from "./titles";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("tool titles", () => {
  it("writes an installed title into its own manifest and keeps the rest of the manifest", async () => {
    const root = await temporaryRoot();
    await writeTool(root, "video-tool");
    const service = new ToolTitleService(root, join(root, "tool-titles.json"));

    expect(await service.rename("video-tool", "  Clip   Trimmer ")).toEqual({ id: "video-tool", name: "Clip Trimmer" });
    const installed = await findInstalledTool("video-tool", root);
    expect(installed?.manifest.name).toBe("Clip Trimmer");
    expect(installed?.manifest.requiredExecutables).toEqual([{ name: "ffmpeg" }]);
    expect(await service.overrides()).toEqual({});
  });

  it("stores a bundled title as an override and applies it to the listed manifest", async () => {
    const root = await temporaryRoot();
    const bundled = firstBundledTool();
    const service = new ToolTitleService(root, join(root, "tool-titles.json"));

    await service.rename(bundled.id, "My Resizer");
    expect(await service.overrides()).toEqual({ [bundled.id]: "My Resizer" });
    const applied = await service.applyToBundled(listBundledTools());
    expect(applied.find((tool) => tool.id === bundled.id)?.name).toBe("My Resizer");
    expect(applied.filter((tool) => tool.id !== bundled.id)).toEqual(
      listBundledTools().filter((tool) => tool.id !== bundled.id),
    );
  });

  it("rejects unknown tools, empty titles, and titles that are too long", async () => {
    const root = await temporaryRoot();
    const service = new ToolTitleService(root, join(root, "tool-titles.json"));

    expect(await service.rename("missing-tool", "Anything")).toBeUndefined();
    await expect(service.rename("video-tool", "  ")).rejects.toThrow("Enter a tool title.");
    await expect(service.rename("video-tool", "x".repeat(81))).rejects.toThrow("under 80 characters");
  });

  it("ignores a damaged override file instead of failing the library", async () => {
    const root = await temporaryRoot();
    const overridePath = join(root, "tool-titles.json");
    await writeFile(overridePath, JSON.stringify({ schemaVersion: 2, titles: { "image-resizer": 5 } }));
    expect(await new ToolTitleService(root, overridePath).overrides()).toEqual({});
  });

  it("keeps the renamed title in the exported manifest source", async () => {
    const root = await temporaryRoot();
    const directory = await writeTool(root, "video-tool");
    await new ToolTitleService(root, join(root, "tool-titles.json")).rename("video-tool", "Clip Trimmer");
    expect(JSON.parse(await readFile(join(directory, "tool.json"), "utf8")).name).toBe("Clip Trimmer");
  });
});

function firstBundledTool() {
  const bundled = listBundledTools()[0];
  if (!bundled) throw new Error("The bundled registry is empty.");
  return bundled;
}

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "scriptforge-titles-"));
  roots.push(root);
  return root;
}

async function writeTool(root: string, id: string) {
  const directory = join(root, id);
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "tool.json"),
    JSON.stringify({
      schemaVersion: 1,
      id,
      version: "1.0.0",
      name: "Video Tool",
      description: "Trim clips.",
      categories: ["Video"],
      icon: "clapperboard",
      script: "run.mjs",
      interface: { type: "html", entry: "ui.html" },
      requiredExecutables: [{ name: "ffmpeg" }],
    }),
  );
  await writeFile(join(directory, "run.mjs"), "export default () => {};");
  await writeFile(join(directory, "ui.html"), "<main>ui</main>");
  return directory;
}
