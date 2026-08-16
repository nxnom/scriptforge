import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ToolReferenceService } from "./reference";
import { listBundledTools } from "./registry";
import { ToolTitleService } from "./titles";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("tool source references", () => {
  it("lists bundled and installed tools without exposing configuration values", async () => {
    const root = await temporaryRoot();
    await writeTool(root, "social-tool");

    const tools = await new ToolReferenceService(root).list();
    expect(tools).toContainEqual(
      expect.objectContaining({ id: "social-tool", origin: "installed", configurationKeys: ["accessToken"] }),
    );
    expect(tools.filter((tool) => tool.origin === "bundled")).toHaveLength(listBundledTools().length);
    expect(JSON.stringify(tools)).not.toContain("value");
  });

  it("reads the manifest, runner, and interface of an installed tool", async () => {
    const root = await temporaryRoot();
    await writeTool(root, "social-tool");

    const source = await new ToolReferenceService(root).read("social-tool");
    expect(source?.origin).toBe("installed");
    expect(source?.files.map((file) => file.path)).toEqual(["tool.json", "run.mjs", "ui.html"]);
    expect(source?.files.find((file) => file.path === "run.mjs")?.content).toBe("export default () => {};");
    expect(source?.files.every((file) => file.truncated === false)).toBe(true);
  });

  it("reads a bundled tool and uses its renamed title", async () => {
    const root = await temporaryRoot();
    const bundled = listBundledTools()[0];
    if (!bundled) throw new Error("The bundled registry is empty.");
    const titles = new ToolTitleService(root, join(root, "tool-titles.json"));
    await titles.rename(bundled.id, "Picture Resizer");

    const source = await new ToolReferenceService(root, undefined, titles).read(bundled.id);
    expect(source).toMatchObject({ id: bundled.id, name: "Picture Resizer", origin: "bundled" });
    expect(source?.files.map((file) => file.path)).toContain("run.mjs");
  });

  it("truncates a file that is larger than the cap", async () => {
    const root = await temporaryRoot();
    const directory = await writeTool(root, "social-tool");
    await writeFile(join(directory, "ui.html"), "x".repeat(300 * 1024));

    const source = await new ToolReferenceService(root).read("social-tool");
    const ui = source?.files.find((file) => file.path === "ui.html");
    expect(ui?.truncated).toBe(true);
    expect(ui?.content.length).toBe(256 * 1024);
  });

  it("returns nothing for a tool that is not in the library", async () => {
    const root = await temporaryRoot();
    expect(await new ToolReferenceService(root).read("missing-tool")).toBeUndefined();
  });
});

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "scriptforge-reference-"));
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
      name: "Social Tool",
      description: "Uses a private token.",
      categories: ["Social"],
      icon: "share",
      script: "run.mjs",
      interface: { type: "html", entry: "ui.html" },
      requiredExecutables: [],
      configuration: [{ key: "accessToken", label: "Access token", type: "secret", required: true }],
    }),
  );
  await writeFile(join(directory, "run.mjs"), "export default () => {};");
  await writeFile(join(directory, "ui.html"), "<main>ui</main>");
  return directory;
}
