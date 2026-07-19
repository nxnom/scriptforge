import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ToolArchiveService } from "./archive";
import { findInstalledTool } from "./installed";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe(".forge archives", () => {
  it("exports every file and atomically imports the tool without executing it", async () => {
    const root = await temporaryRoot();
    const source = join(root, "source");
    const destination = join(root, "destination");
    await writeTool(source);
    const exported = await new ToolArchiveService(source).export("video-tool");
    expect(exported?.filename).toBe("video-tool.forge");

    const imported = await new ToolArchiveService(destination).import(exported?.data ?? new Uint8Array());
    expect(imported.manifest.id).toBe("video-tool");
    expect(await readFile(join(destination, "video-tool", "assets", "note.txt"), "utf8")).toBe("supporting file");
    expect((await findInstalledTool("video-tool", destination))?.manifest.requiredExecutables).toEqual([
      { name: "ffmpeg", version: ">= 7.0.0" },
    ]);
  });

  it("rejects traversal paths and leaves no installed tool behind", async () => {
    const root = await temporaryRoot();
    const archive = Buffer.from(
      JSON.stringify({
        format: "scriptforge-tool",
        formatVersion: 1,
        files: [encoded("tool.json", "{}"), encoded("run.mjs", ""), encoded("../ui.html", "")],
      }),
    );
    await expect(new ToolArchiveService(root).import(archive)).rejects.toThrow();
    expect(await findInstalledTool("video-tool", root)).toBeUndefined();
  });

  it("rejects duplicate archive paths", async () => {
    const root = await temporaryRoot();
    const archive = Buffer.from(
      JSON.stringify({
        format: "scriptforge-tool",
        formatVersion: 1,
        files: [encoded("tool.json", "{}"), encoded("run.mjs", "one"), encoded("run.mjs", "two")],
      }),
    );
    await expect(new ToolArchiveService(root).import(archive)).rejects.toThrow("duplicate path run.mjs");
  });

  it("rejects identifiers reserved by bundled tools", async () => {
    const root = await temporaryRoot();
    const source = join(root, "source");
    await writeTool(source);
    const archive = await new ToolArchiveService(source).export("video-tool");
    await expect(
      new ToolArchiveService(join(root, "destination"), new Set(["video-tool"])).import(
        archive?.data ?? new Uint8Array(),
      ),
    ).rejects.toThrow("bundled tool");
  });
});

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "scriptforge-archive-"));
  roots.push(root);
  return root;
}

async function writeTool(root: string) {
  const directory = join(root, "video-tool");
  await mkdir(join(directory, "assets"), { recursive: true });
  const runSource = 'throw new Error("Import must not execute this script.");';
  await Promise.all([
    writeFile(
      join(directory, "tool.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "video-tool",
        version: "1.0.0",
        name: "Video Tool",
        description: "Converts a video.",
        category: "Video",
        icon: "video",
        script: "run.mjs",
        interface: { type: "html", entry: "ui.html" },
        requiredExecutables: [{ name: "ffmpeg", version: ">= 7.0.0" }],
      }),
    ),
    writeFile(join(directory, "run.mjs"), runSource),
    writeFile(join(directory, "ui.html"), "<!doctype html>"),
    writeFile(join(directory, "assets", "note.txt"), "supporting file"),
  ]);
}

function encoded(path: string, content: string) {
  return { path, encoding: "base64", content: Buffer.from(content).toString("base64") };
}
