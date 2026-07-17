import { basename, extname, join } from "node:path";
import sharp from "sharp";

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
const fail = (message) => {
  emit({ type: "log", level: "error", message });
  emit({ type: "failed", message });
  process.exitCode = 1;
};

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

try {
  const request = JSON.parse(raw);
  const file = request.files?.[0];
  if (!file) throw new Error("Choose an image before running the tool.");

  const width = boundedInteger(request.input?.width, 1, 8000, "width");
  const height = boundedInteger(request.input?.height, 1, 8000, "height");
  const quality = boundedInteger(request.input?.quality ?? 82, 1, 100, "quality");
  const fit = oneOf(request.input?.fit, ["cover", "contain", "fill", "inside", "outside"], "contain");
  const requestedFormat = oneOf(request.input?.format, ["preserve", "jpeg", "png", "webp"], "preserve");

  emit({ type: "log", level: "info", message: `Reading ${file.name}` });
  emit({ type: "progress", value: 0.15, label: "Reading image" });
  const source = sharp(file.path, { failOn: "error", limitInputPixels: 100_000_000 });
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height || !metadata.format) throw new Error("The file is not a supported image.");

  const format = resolveFormat(requestedFormat, metadata.format);
  const stem = basename(file.name, extname(file.name)).replace(/[^a-zA-Z0-9_-]+/g, "-") || "image";
  const extension = format === "jpeg" ? "jpg" : format;
  const filename = `${stem}-${width}x${height}.${extension}`;
  const outputPath = join(request.outputDir, filename);

  emit({ type: "log", level: "info", message: `Resizing to ${width} × ${height} using ${fit}` });
  emit({ type: "progress", value: 0.45, label: "Resizing image" });
  const pipeline = source.resize({ width, height, fit });
  if (format === "jpeg") pipeline.jpeg({ quality, mozjpeg: true });
  if (format === "png") pipeline.png({ quality });
  if (format === "webp") pipeline.webp({ quality });
  const info = await pipeline.toFile(outputPath);

  emit({ type: "progress", value: 0.9, label: "Registering result" });
  emit({ type: "log", level: "success", message: `Created ${filename}` });
  emit({
    type: "result",
    outputs: [
      {
        path: filename,
        name: filename,
        mimeType: `image/${format}`,
        metadata: {
          original: { width: metadata.width, height: metadata.height, format: metadata.format, bytes: file.size },
          output: { width: info.width, height: info.height, format, bytes: info.size },
        },
      },
    ],
  });
  emit({ type: "progress", value: 1, label: "Complete" });
} catch (error) {
  fail(error instanceof Error ? error.message : "Image resizing failed.");
}

function boundedInteger(value, min, max, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max)
    throw new Error(`${name} must be between ${min} and ${max}.`);
  return number;
}

function oneOf(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

function resolveFormat(requested, source) {
  if (requested !== "preserve") return requested;
  if (source === "jpg") return "jpeg";
  return ["jpeg", "png", "webp"].includes(source) ? source : "png";
}
