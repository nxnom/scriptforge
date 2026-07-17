import sharp from "sharp";

export const resizeFormats = ["preserve", "jpeg", "png", "webp"] as const;
export const resizeFits = ["cover", "contain", "fill", "inside", "outside"] as const;

export interface ResizeOptions {
  width: number;
  height: number;
  fit: (typeof resizeFits)[number];
  format: (typeof resizeFormats)[number];
  quality: number;
}

export interface ImageDetails {
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export interface ResizeResult {
  data: Buffer;
  original: ImageDetails;
  output: ImageDetails;
  contentType: string;
  extension: string;
}

const outputFormats = {
  jpeg: { contentType: "image/jpeg", extension: "jpg" },
  png: { contentType: "image/png", extension: "png" },
  webp: { contentType: "image/webp", extension: "webp" },
} as const;

type OutputFormat = keyof typeof outputFormats;

function resolveFormat(requested: ResizeOptions["format"], source?: string): OutputFormat {
  if (requested !== "preserve") return requested;
  if (source === "jpg") return "jpeg";
  if (source === "jpeg" || source === "png" || source === "webp") return source;
  return "png";
}

export async function resizeImage(input: Buffer, options: ResizeOptions): Promise<ResizeResult> {
  const source = sharp(input, { failOn: "error", limitInputPixels: 100_000_000 });
  const metadata = await source.metadata();

  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new Error("The selected file is not a supported image.");
  }

  const format = resolveFormat(options.format, metadata.format);
  const pipeline = source.resize({ width: options.width, height: options.height, fit: options.fit });

  if (format === "jpeg") pipeline.jpeg({ quality: options.quality, mozjpeg: true });
  if (format === "png") pipeline.png({ quality: options.quality });
  if (format === "webp") pipeline.webp({ quality: options.quality });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const outputFormat = outputFormats[format];

  return {
    data,
    original: { width: metadata.width, height: metadata.height, format: metadata.format, bytes: input.byteLength },
    output: { width: info.width, height: info.height, format, bytes: info.size },
    contentType: outputFormat.contentType,
    extension: outputFormat.extension,
  };
}
