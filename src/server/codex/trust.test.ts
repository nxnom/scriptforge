import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCodexTrusted } from "./trust";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Codex staging trust", () => {
  it("adds the exact staging directory once without replacing existing config", async () => {
    const root = await mkdtemp(join(tmpdir(), "scriptforge-trust-"));
    roots.push(root);
    const staging = join(root, "staging", "candidate");
    const config = join(root, ".codex", "config.toml");
    await mkdir(staging, { recursive: true });

    await ensureCodexTrusted(staging, config);
    await ensureCodexTrusted(staging, config);
    const contents = await readFile(config, "utf8");
    const canonicalStaging = await realpath(staging);

    expect(contents).toContain(`[projects."${canonicalStaging}"]`);
    expect(contents).toContain('trust_level = "trusted"');
    expect(contents.match(/trust_level = "trusted"/g)).toHaveLength(1);
  });
});
