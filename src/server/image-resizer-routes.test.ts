// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("image resizer API", () => {
  let jobsRoot: string;

  beforeEach(async () => {
    jobsRoot = await mkdtemp(join(tmpdir(), "scriptforge-resize-"));
  });

  afterEach(async () => {
    await rm(jobsRoot, { recursive: true, force: true });
  });

  it("resizes an upload and serves the result", async () => {
    const source = await sharp({
      create: { width: 96, height: 64, channels: 3, background: "#ef7b45" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.append("file", new File([source], "sample.png", { type: "image/png" }));
    form.append("width", "48");
    form.append("height", "48");
    form.append("fit", "contain");
    form.append("format", "webp");
    form.append("quality", "80");

    const app = createApp(undefined, { jobsRoot });
    const response = await app.request("/api/tools/image-resizer/resize", { method: "POST", body: form });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      result: { filename: "sample-48x48.webp", output: { width: 48, height: 48, format: "webp" } },
    });
    if (!body.ok) throw new Error("Resize failed during test");

    const preview = await app.request(body.result.previewUrl);
    expect(preview.headers.get("content-type")).toBe("image/webp");
    await expect(sharp(Buffer.from(await preview.arrayBuffer())).metadata()).resolves.toMatchObject({
      width: 48,
      height: 48,
      format: "webp",
    });
  });

  it("rejects requests without an image", async () => {
    const form = new FormData();
    form.append("width", "48");
    form.append("height", "48");
    form.append("fit", "contain");
    form.append("format", "png");
    form.append("quality", "80");

    const response = await createApp(undefined, { jobsRoot }).request("/api/tools/image-resizer/resize", {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Choose an image to resize." });
  });
});
