import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import { type ResizeResult, resizeFits, resizeFormats, resizeImage } from "../tools/bundled/image-resizer/resize";

const maxInputBytes = 20 * 1024 * 1024;
const resultIdPattern = /^[0-9a-f-]{36}$/;
const resizeRequestSchema = z.object({
  width: z.coerce.number().int().min(1).max(8_000),
  height: z.coerce.number().int().min(1).max(8_000),
  fit: z.enum(resizeFits),
  format: z.enum(resizeFormats),
  quality: z.coerce.number().int().min(1).max(100),
});

interface StoredResult extends Omit<ResizeResult, "data"> {
  path: string;
  filename: string;
}

function makeOutputFilename(inputName: string, width: number, height: number, extension: string) {
  const stem = basename(inputName, extname(inputName)).replace(/[^a-zA-Z0-9_-]+/g, "-") || "image";
  return `${stem}-${width}x${height}.${extension}`;
}

export function createImageResizerRoutes(jobsRoot = join(homedir(), ".scriptforge", "jobs")) {
  const results = new Map<string, StoredResult>();

  return new Hono()
    .post(
      "/resize",
      validator("form", (formValue, c) => {
        const file = formValue.file;
        const options = resizeRequestSchema.safeParse(formValue);
        if (!(file instanceof File)) {
          return c.json({ ok: false as const, error: "Choose an image to resize." }, 400);
        }
        if (!options.success) {
          return c.json({ ok: false as const, error: "Check the dimensions and output options." }, 400);
        }
        return { file, ...options.data };
      }),
      async (c) => {
        const request = c.req.valid("form");
        if (request.file.size > maxInputBytes) {
          return c.json({ ok: false as const, error: "Images must be 20 MB or smaller." }, 413);
        }

        try {
          const input = Buffer.from(await request.file.arrayBuffer());
          const resized = await resizeImage(input, request);
          const resultId = randomUUID();
          const resultDirectory = join(jobsRoot, resultId);
          const filename = makeOutputFilename(
            request.file.name,
            resized.output.width,
            resized.output.height,
            resized.extension,
          );
          const path = join(resultDirectory, filename);
          await mkdir(resultDirectory, { recursive: true });
          await writeFile(path, resized.data);
          results.set(resultId, {
            original: resized.original,
            output: resized.output,
            contentType: resized.contentType,
            extension: resized.extension,
            path,
            filename,
          });

          return c.json({
            ok: true as const,
            result: {
              id: resultId,
              filename,
              previewUrl: `/api/tools/image-resizer/results/${resultId}`,
              downloadUrl: `/api/tools/image-resizer/results/${resultId}?download=1`,
              original: resized.original,
              output: resized.output,
            },
          });
        } catch {
          return c.json({ ok: false as const, error: "This file could not be decoded as a supported image." }, 422);
        }
      },
    )
    .get("/results/:resultId", async (c) => {
      const resultId = c.req.param("resultId");
      const result = resultIdPattern.test(resultId) ? results.get(resultId) : undefined;
      if (!result) return c.json({ ok: false as const, error: "That resize result is no longer available." }, 404);

      const data = await readFile(result.path);
      const disposition = c.req.query("download") === "1" ? "attachment" : "inline";
      c.header("Content-Type", result.contentType);
      c.header("Content-Length", String(data.byteLength));
      c.header("Content-Disposition", `${disposition}; filename="${result.filename}"`);
      c.header("Cache-Control", "no-store");
      return c.body(Uint8Array.from(data));
    });
}
