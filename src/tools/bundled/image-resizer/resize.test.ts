import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { resizeImage } from "./resize";

describe("image resizer", () => {
  it("resizes and converts an image", async () => {
    const input = await sharp({
      create: { width: 120, height: 80, channels: 3, background: "#ef7b45" },
    })
      .png()
      .toBuffer();

    const result = await resizeImage(input, {
      width: 60,
      height: 60,
      fit: "contain",
      format: "webp",
      quality: 82,
    });

    expect(result.original).toMatchObject({ width: 120, height: 80, format: "png" });
    expect(result.output).toMatchObject({ width: 60, height: 60, format: "webp" });
    expect(result.contentType).toBe("image/webp");
    await expect(sharp(result.data).metadata()).resolves.toMatchObject({ width: 60, height: 60 });
  });

  it("rejects input that is not an image", async () => {
    await expect(
      resizeImage(Buffer.from("not an image"), {
        width: 100,
        height: 100,
        fit: "cover",
        format: "preserve",
        quality: 80,
      }),
    ).rejects.toThrow();
  });
});
