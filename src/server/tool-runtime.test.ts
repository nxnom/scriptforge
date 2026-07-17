// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("tool runtime host", () => {
  let jobsRoot: string;

  beforeEach(async () => {
    jobsRoot = await mkdtemp(join(tmpdir(), "scriptforge-runtime-"));
  });

  afterEach(async () => {
    await rm(jobsRoot, { recursive: true, force: true });
  });

  it("serves the self-contained tool UI with a restricted content policy", async () => {
    const app = createApp(undefined, { jobsRoot, toolsRoot: resolve("src/tools/bundled") });
    const response = await app.request("/api/tools/image-resizer/ui");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'none'");
    await expect(response.text()).resolves.toContain('source: "scriptforge-tool"');
  });

  it("rejects a job without user-selected files", async () => {
    const form = new FormData();
    form.append("toolId", "image-resizer");
    form.append("input", "{}");
    const app = createApp(undefined, { jobsRoot, toolsRoot: resolve("src/tools/bundled") });
    const response = await app.request("/api/jobs", { method: "POST", body: form });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });
});
