import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ToolCloneService, toToolId } from "./clone";
import { findInstalledTool } from "./installed";
import { listBundledTools } from "./registry";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("tool clones", () => {
  it("copies every file, keeps the source intact, and gives the clone a new id and title", async () => {
    const root = await temporaryRoot();
    await writeTool(root, "video-tool");

    const clone = await new ToolCloneService(root).clone("video-tool", "  Video   Tool  Pro  ");
    expect(clone.manifest.id).toBe("video-tool-pro");
    expect(clone.manifest.name).toBe("Video Tool Pro");
    expect(clone.source).toEqual({ id: "video-tool", origin: "installed" });
    expect(await readFile(join(clone.directory, "assets", "note.txt"), "utf8")).toBe("supporting file");
    expect(await readFile(join(clone.directory, "run.mjs"), "utf8")).toBe("export default () => {};");

    const source = await findInstalledTool("video-tool", root);
    expect(source?.manifest.name).toBe("Video Tool");
    expect(source?.manifest.version).toBe("1.0.0");
    expect((await findInstalledTool("video-tool-pro", root))?.manifest.name).toBe("Video Tool Pro");
  });

  it("clones a bundled tool into an editable installed copy", async () => {
    const root = await temporaryRoot();
    const bundled = firstBundledTool();

    const clone = await new ToolCloneService(root).clone(bundled.id, "My Resizer");
    expect(clone.source.origin).toBe("bundled");
    expect(clone.manifest.id).toBe("my-resizer");
    expect(clone.manifest.script).toBe(bundled.script);
    expect((await findInstalledTool("my-resizer", root))?.manifest.name).toBe("My Resizer");
  });

  it("adds a suffix when the title maps to a taken identifier and never overwrites a tool", async () => {
    const root = await temporaryRoot();
    await writeTool(root, "video-tool");

    const first = await new ToolCloneService(root).clone("video-tool", "Video Tool");
    const second = await new ToolCloneService(root).clone("video-tool", "Video Tool");
    expect([first.manifest.id, second.manifest.id]).toEqual(["video-tool-2", "video-tool-3"]);
    expect((await findInstalledTool("video-tool", root))?.manifest.name).toBe("Video Tool");
  });

  it("never claims a bundled identifier", async () => {
    const root = await temporaryRoot();
    const bundled = firstBundledTool();

    const clone = await new ToolCloneService(root).clone(bundled.id, bundled.name);
    expect(clone.manifest.id).not.toBe(bundled.id);
  });

  it("rejects an unknown tool and an empty title", async () => {
    const root = await temporaryRoot();
    await writeTool(root, "video-tool");
    await expect(new ToolCloneService(root).clone("missing-tool", "Copy")).rejects.toThrow(
      "That tool is not available to clone.",
    );
    await expect(new ToolCloneService(root).clone("video-tool", "   ")).rejects.toThrow("Enter a tool title.");
  });

  it("builds identifiers from titles", () => {
    expect(toToolId("PDF Toolkit 2!")).toBe("pdf-toolkit-2");
    expect(toToolId("***")).toBe("");
  });
});

function firstBundledTool() {
  const bundled = listBundledTools()[0];
  if (!bundled) throw new Error("The bundled registry is empty.");
  return bundled;
}

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "scriptforge-clone-"));
  roots.push(root);
  return root;
}

async function writeTool(root: string, id: string) {
  const directory = join(root, id);
  await mkdir(join(directory, "assets"), { recursive: true });
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
  await writeFile(join(directory, "assets", "note.txt"), "supporting file");
  return directory;
}
