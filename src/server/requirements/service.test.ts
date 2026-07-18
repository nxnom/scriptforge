import { describe, expect, it } from "vitest";
import { RequirementService } from "./service";

describe("executable requirements", () => {
  it("reports missing and version-mismatched executables", async () => {
    const service = new RequirementService(async (name) =>
      name === "ffmpeg" ? { found: true, version: "6.1.0" } : { found: false, version: null },
    );

    await expect(service.check([{ name: "ffmpeg", version: ">= 7.0.0" }, { name: "magick" }])).resolves.toEqual([
      {
        name: "ffmpeg",
        version: ">= 7.0.0",
        available: false,
        detectedVersion: "6.1.0",
        reason: "version_mismatch",
      },
      { name: "magick", available: false, detectedVersion: null, reason: "missing" },
    ]);
  });

  it("allows a requirement that satisfies its declared version", async () => {
    const service = new RequirementService(async () => ({ found: true, version: "7.1.2" }));
    await expect(service.assertAvailable([{ name: "ffmpeg", version: ">= 7.0.0" }])).resolves.toBeUndefined();
  });
});
