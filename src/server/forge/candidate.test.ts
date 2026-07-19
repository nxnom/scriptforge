import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { maximumCandidateFileBytes, readForgeCandidate } from "./candidate";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Forge candidate reader", () => {
  it("loads and fingerprints the three review files", async () => {
    const root = await candidateDirectory();
    const candidate = await readForgeCandidate(root, {
      summary: "Ready to review",
      testSummary: "Processed a sample successfully.",
    });

    expect(candidate).toMatchObject({
      name: "Tiny Tool",
      requiredExecutables: [],
      summary: "Ready to review",
      testSummary: "Processed a sample successfully.",
    });
    expect(candidate.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(candidate.scriptSource).toContain("started");
    expect(candidate.interfaceHtml).toContain("Tiny Tool");
  });

  it("rejects symlinked candidate files", async () => {
    const root = await candidateDirectory();
    const outside = join(root, "outside.mjs");
    await writeFile(outside, "secret");
    await rm(join(root, "run.mjs"));
    await symlink(outside, join(root, "run.mjs"));

    await expect(
      readForgeCandidate(root, { summary: "Ready", testSummary: "Processed a sample successfully." }),
    ).rejects.toThrow("unsafe");
  });

  it("returns the exact invalid manifest fields", async () => {
    const root = await candidateDirectory();
    await writeFile(join(root, "tool.json"), JSON.stringify({ name: "Incomplete" }));

    await expect(
      readForgeCandidate(root, { summary: "Ready", testSummary: "Processed a sample successfully." }),
    ).rejects.toThrow(/schemaVersion:.*id:.*version:.*requiredExecutables:/);
  });

  it("accepts an inlined browser library larger than the old 500 KB limit", async () => {
    const root = await candidateDirectory();
    await writeFile(join(root, "ui.html"), `<!doctype html><script>/* ${"x".repeat(600_000)} */</script>`);

    await expect(
      readForgeCandidate(root, { summary: "Ready", testSummary: "Processed a sample successfully." }),
    ).resolves.toMatchObject({ name: "Tiny Tool" });
  });

  it("rejects a candidate file above the 3 MB review limit", async () => {
    const root = await candidateDirectory();
    await writeFile(join(root, "ui.html"), "x".repeat(maximumCandidateFileBytes + 1));

    await expect(
      readForgeCandidate(root, { summary: "Ready", testSummary: "Processed a sample successfully." }),
    ).rejects.toThrow("exceeds the 3 MB review limit");
  });
});

async function candidateDirectory() {
  const root = await mkdtemp(join(tmpdir(), "scriptforge-candidate-"));
  roots.push(root);
  await Promise.all([
    writeFile(
      join(root, "tool.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "tiny-tool",
        version: "1.0.0",
        name: "Tiny Tool",
        description: "A tiny test tool.",
        category: "Files",
        icon: "file",
        script: "run.mjs",
        interface: { type: "html", entry: "ui.html" },
        requiredExecutables: [],
      }),
    ),
    writeFile(join(root, "run.mjs"), 'console.log("started")'),
    writeFile(join(root, "ui.html"), "<!doctype html><title>Tiny Tool</title>"),
  ]);
  return root;
}
