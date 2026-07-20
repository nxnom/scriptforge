import { spawn } from "node:child_process";
import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
const fail = (message) => {
  emit({ type: "log", level: "error", message });
  emit({ type: "failed", message });
  process.exitCode = 1;
};
let child;
let lastProgress = 0;
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  return current >>> 0;
});
const progress = (value, label) => {
  lastProgress = Math.max(lastProgress, Math.max(0, Math.min(1, Number(value) || 0)));
  emit({ type: "progress", value: lastProgress, label });
};

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    child?.kill(signal);
    emit({ type: "log", level: "warning", message: "Media job cancelled." });
    process.exitCode = 130;
  });
}

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

try {
  const request = JSON.parse(raw);
  const input = normalizeInput(request.input);
  const source = request.files?.[0];
  if (!source) throw new Error("Choose a source video or audio file first.");
  if (input.operation === "replace-audio" && !request.files?.[1])
    throw new Error("Choose the replacement audio track.");

  emit({ type: "log", level: "info", message: `Preparing ${operationLabel(input.operation)}.` });
  progress(0.03, "Checking media options");

  const output = await buildJob({ request, input, source, audio: request.files?.[1] });
  emit({ type: "log", level: "info", message: "Starting declared ffmpeg executable." });
  progress(0.06, operationLabel(input.operation));
  const result = await runFfmpeg(output.args, input.duration);
  if (result.code !== 0) throw new Error(friendlyFailure(result.diagnostics));

  let finalOutput = output;
  if (input.operation === "frames") {
    progress(0.91, "Packing extracted frames");
    const frames = await listFiles(output.framesDirectory);
    if (!frames.length) throw new Error("FFmpeg completed without extracting any frames.");
    const archiveName = `${safeBase(source.name)}-frames.zip`;
    const archivePath = join(request.outputDir, archiveName);
    const bytes = await createStoredZip(frames, archivePath, (value) =>
      progress(0.91 + value * 0.07, "Packing extracted frames"),
    );
    finalOutput = {
      path: archiveName,
      name: archiveName,
      mimeType: "application/zip",
      metadata: { bytes, files: frames.length, operation: input.operation },
    };
  } else {
    const details = await stat(join(request.outputDir, output.path));
    finalOutput = {
      path: output.path,
      name: output.name,
      mimeType: output.mimeType,
      metadata: { bytes: details.size, files: 1, operation: input.operation },
    };
  }

  emit({ type: "log", level: "success", message: `${operationLabel(input.operation)} complete.` });
  emit({ type: "result", outputs: [finalOutput] });
  progress(1, "Complete");
} catch (error) {
  fail(error instanceof Error ? error.message : "The FFmpeg media job failed.");
}

function normalizeInput(value) {
  const operations = new Set([
    "video-convert",
    "video-compress",
    "resize-video",
    "trim-media",
    "extract-audio",
    "audio-convert",
    "make-gif",
    "frames",
    "replace-audio",
    "mute-video",
  ]);
  const operation = operations.has(value?.operation) ? value.operation : "video-convert";
  const start = boundedNumber(value?.start, 0, 86_400, 0);
  const end = optionalBoundedNumber(value?.end, 0.01, 86_400);
  if (end !== undefined && end <= start) throw new Error("End time must be after the start time.");
  return {
    operation,
    videoFormat: allowed(value?.videoFormat, ["mp4", "webm", "mov", "mkv"], "mp4"),
    audioFormat: allowed(value?.audioFormat, ["mp3", "m4a", "wav", "ogg"], "mp3"),
    quality: allowed(value?.quality, ["high", "balanced", "small"], "balanced"),
    height: Number(allowed(String(value?.height), ["2160", "1080", "720", "480", "360"], "720")),
    gifWidth: Number(allowed(String(value?.gifWidth), ["960", "640", "480", "320"], "640")),
    fps: Number(allowed(String(value?.fps), ["1", "2", "5", "10", "12", "15", "24"], "12")),
    frameLimit: Math.round(boundedNumber(value?.frameLimit, 1, 300, 120)),
    start,
    end,
    duration: optionalBoundedNumber(value?.duration, 0.01, 604_800),
  };
}

async function buildJob({ request, input, source, audio }) {
  const base = safeBase(source.name);
  const trim = trimArgs(input);
  const videoQuality = { high: "18", balanced: "23", small: "30" }[input.quality];
  const audioBitrate = { high: "256k", balanced: "160k", small: "96k" }[input.quality];
  const commonVideo = ["-c:v", "libx264", "-preset", "medium", "-crf", videoQuality, "-pix_fmt", "yuv420p"];
  const fastStart = ["-movflags", "+faststart"];
  const inputArgs = ["-hide_banner", "-y", ...trim.beforeInput, "-i", source.path];
  const progressArgs = ["-progress", "pipe:1", "-nostats"];

  if (input.operation === "video-convert") {
    const extension = input.videoFormat;
    const name = `${base}-converted.${extension}`;
    const codecs = videoCodecs(extension, videoQuality, audioBitrate);
    return fileJob(request.outputDir, name, [
      ...inputArgs,
      ...trim.afterInput,
      ...codecs,
      ...(extension === "mp4" ? fastStart : []),
      ...progressArgs,
    ]);
  }
  if (input.operation === "video-compress") {
    const name = `${base}-compressed.mp4`;
    return fileJob(request.outputDir, name, [
      ...inputArgs,
      ...trim.afterInput,
      ...commonVideo,
      "-c:a",
      "aac",
      "-b:a",
      audioBitrate,
      ...fastStart,
      ...progressArgs,
    ]);
  }
  if (input.operation === "resize-video") {
    const name = `${base}-${input.height}p.mp4`;
    return fileJob(request.outputDir, name, [
      ...inputArgs,
      ...trim.afterInput,
      "-vf",
      `scale=-2:${input.height}:flags=lanczos`,
      ...commonVideo,
      "-c:a",
      "aac",
      "-b:a",
      audioBitrate,
      ...fastStart,
      ...progressArgs,
    ]);
  }
  if (input.operation === "trim-media") {
    const extension = mediaExtension(source.name);
    const name = `${base}-trimmed.${extension}`;
    const args = isAudioExtension(extension)
      ? [...inputArgs, ...trim.afterInput, ...audioCodec(extension, audioBitrate), ...progressArgs]
      : [
          ...inputArgs,
          ...trim.afterInput,
          ...videoCodecs(extension, videoQuality, audioBitrate),
          ...(extension === "mp4" ? fastStart : []),
          ...progressArgs,
        ];
    return fileJob(request.outputDir, name, args);
  }
  if (input.operation === "extract-audio" || input.operation === "audio-convert") {
    const extension = input.audioFormat;
    const suffix = input.operation === "extract-audio" ? "audio" : "converted";
    const name = `${base}-${suffix}.${extension}`;
    return fileJob(request.outputDir, name, [
      ...inputArgs,
      ...trim.afterInput,
      "-vn",
      ...audioCodec(extension, audioBitrate),
      ...progressArgs,
    ]);
  }
  if (input.operation === "make-gif") {
    const name = `${base}.gif`;
    const filter = `fps=${input.fps},scale=${input.gifWidth}:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=sierra2_4a`;
    return fileJob(request.outputDir, name, [
      ...inputArgs,
      ...trim.afterInput,
      "-filter_complex",
      filter,
      "-loop",
      "0",
      ...progressArgs,
    ]);
  }
  if (input.operation === "frames") {
    const framesDirectory = join(request.outputDir, "frames");
    await mkdir(framesDirectory, { recursive: true });
    return {
      args: [
        ...inputArgs,
        ...trim.afterInput,
        "-vf",
        `fps=${input.fps},scale='min(1280,iw)':-2:flags=lanczos`,
        "-frames:v",
        String(input.frameLimit),
        ...progressArgs,
        join(framesDirectory, "frame-%04d.png"),
      ],
      framesDirectory,
    };
  }
  if (input.operation === "replace-audio") {
    const name = `${base}-new-audio.mp4`;
    return fileJob(request.outputDir, name, [
      "-hide_banner",
      "-y",
      ...trim.beforeInput,
      "-i",
      source.path,
      "-i",
      audio.path,
      ...trim.afterInput,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      ...commonVideo,
      "-c:a",
      "aac",
      "-b:a",
      audioBitrate,
      "-shortest",
      ...fastStart,
      ...progressArgs,
    ]);
  }
  const name = `${base}-muted.mp4`;
  return fileJob(request.outputDir, name, [
    ...inputArgs,
    ...trim.afterInput,
    "-an",
    ...commonVideo,
    ...fastStart,
    ...progressArgs,
  ]);
}

function fileJob(outputDir, name, args) {
  return { args: [...args, join(outputDir, name)], path: name, name, mimeType: mimeType(name) };
}

function trimArgs(input) {
  const beforeInput = input.start > 0 ? ["-ss", seconds(input.start)] : [];
  const afterInput = input.end !== undefined ? ["-t", seconds(input.end - input.start)] : [];
  return { beforeInput, afterInput };
}

function videoCodecs(extension, quality, audioBitrate) {
  if (extension === "webm")
    return ["-c:v", "libvpx-vp9", "-crf", quality, "-b:v", "0", "-c:a", "libopus", "-b:a", audioBitrate];
  return [
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    quality,
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    audioBitrate,
  ];
}

function audioCodec(extension, bitrate) {
  if (extension === "wav") return ["-c:a", "pcm_s16le"];
  if (extension === "m4a") return ["-c:a", "aac", "-b:a", bitrate];
  if (extension === "ogg") return ["-c:a", "libvorbis", "-q:a", "5"];
  return ["-c:a", "libmp3lame", "-b:a", bitrate];
}

function runFfmpeg(args, duration) {
  return new Promise((resolve, reject) => {
    const diagnostics = [];
    let stdoutBuffer = "";
    let stderrBuffer = "";
    child = spawn("ffmpeg", args, { shell: false, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    child.once("error", (error) =>
      reject(new Error(error.code === "ENOENT" ? "FFmpeg is not installed." : "FFmpeg could not start.")),
    );
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      stdoutBuffer = drainLines(stdoutBuffer, (line) => handleFfmpegProgress(line, duration));
    });
    child.stderr.on("data", (chunk) => {
      stderrBuffer += chunk;
      stderrBuffer = drainLines(stderrBuffer, (line) => {
        const safe = sanitizeDiagnostic(line);
        if (safe) diagnostics.push(safe);
        if (diagnostics.length > 14) diagnostics.shift();
      });
    });
    child.once("close", (code) => {
      handleFfmpegProgress(stdoutBuffer.trim(), duration);
      const safe = sanitizeDiagnostic(stderrBuffer);
      if (safe) diagnostics.push(safe);
      child = undefined;
      resolve({ code, diagnostics });
    });
  });
}

function handleFfmpegProgress(line, duration) {
  if (line === "progress=end") return progress(0.9, "Finalizing output");
  if (!duration) return;
  const match = line.match(/^out_time=(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) return;
  const elapsed = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  progress(0.07 + Math.min(1, elapsed / duration) * 0.81, "Processing with FFmpeg");
}

function drainLines(buffer, visit) {
  const lines = buffer.split(/\r?\n/);
  for (const line of lines.slice(0, -1)) visit(line);
  return lines.at(-1) ?? "";
}

function sanitizeDiagnostic(value) {
  return String(value)
    .replace(/(?:[A-Za-z]:)?[/\\][^\s,;]+/g, "[local media]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function friendlyFailure(lines) {
  const text = lines.join(" ").toLowerCase();
  if (text.includes("invalid data found") || text.includes("could not find codec parameters"))
    return "FFmpeg could not read this media file. It may be damaged or use an unsupported codec.";
  if (text.includes("unknown encoder")) return "This FFmpeg build does not include an encoder required by that format.";
  if (text.includes("no such file")) return "One of the selected media files is no longer available.";
  if (text.includes("matches no streams") || text.includes("does not contain any stream"))
    return "The selected file does not contain the video or audio stream this operation needs.";
  return "FFmpeg could not complete this operation. Try another format or source file.";
}

function operationLabel(operation) {
  return {
    "video-convert": "Converting video",
    "video-compress": "Compressing video",
    "resize-video": "Resizing video",
    "trim-media": "Trimming media",
    "extract-audio": "Extracting audio",
    "audio-convert": "Converting audio",
    "make-gif": "Creating GIF",
    frames: "Extracting frames",
    "replace-audio": "Replacing audio track",
    "mute-video": "Removing audio track",
  }[operation];
}

function safeBase(name) {
  const base = basename(String(name || "media"), extname(String(name || "")))
    .normalize("NFKD")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "media";
}

function mediaExtension(name) {
  const extension = extname(String(name)).slice(1).toLowerCase();
  return ["mp4", "mov", "mkv", "webm", "mp3", "m4a", "wav", "ogg"].includes(extension) ? extension : "mp4";
}

function isAudioExtension(extension) {
  return ["mp3", "m4a", "wav", "ogg"].includes(extension);
}

function mimeType(name) {
  const extension = extname(name).slice(1).toLowerCase();
  return (
    {
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      mkv: "video/x-matroska",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      wav: "audio/wav",
      ogg: "audio/ogg",
      gif: "image/gif",
    }[extension] ?? "application/octet-stream"
  );
}

function allowed(value, values, fallback) {
  return values.includes(value) ? value : fallback;
}

function boundedNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : fallback;
}

function optionalBoundedNumber(value, minimum, maximum) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum)
    throw new Error(`Time values must be between ${minimum} and ${maximum} seconds.`);
  return number;
}

function seconds(value) {
  return Number(value).toFixed(3);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const path = join(directory, entry.name);
    const details = await stat(path);
    files.push({ name: entry.name, path, size: details.size });
  }
  return files.sort((left, right) => left.name.localeCompare(right.name));
}

async function createStoredZip(files, outputPath, onProgress) {
  const records = [];
  let offset = 0;
  let processed = 0;
  const total = files.reduce((sum, file) => sum + file.size, 0) || 1;
  const output = createWriteStream(outputPath);
  for (const file of files) {
    const name = Buffer.from(file.name);
    const checksum = await crc32File(file.path);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(file.size, 18);
    local.writeUInt32LE(file.size, 22);
    local.writeUInt16LE(name.length, 26);
    await writeChunk(output, local);
    await writeChunk(output, name);
    for await (const chunk of createReadStream(file.path)) {
      await writeChunk(output, chunk);
      processed += chunk.length;
      onProgress(processed / total);
    }
    records.push({ name, checksum, size: file.size, offset });
    offset += local.length + name.length + file.size;
  }
  const centralOffset = offset;
  for (const record of records) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt32LE(record.checksum, 16);
    header.writeUInt32LE(record.size, 20);
    header.writeUInt32LE(record.size, 24);
    header.writeUInt16LE(record.name.length, 28);
    header.writeUInt32LE(record.offset, 42);
    await writeChunk(output, header);
    await writeChunk(output, record.name);
    offset += header.length + record.name.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(records.length, 8);
  end.writeUInt16LE(records.length, 10);
  end.writeUInt32LE(offset - centralOffset, 12);
  end.writeUInt32LE(centralOffset, 16);
  await writeChunk(output, end);
  output.end();
  await once(output, "close");
  return offset + end.length;
}

function writeChunk(stream, chunk) {
  return stream.write(chunk) ? Promise.resolve() : once(stream, "drain");
}

async function crc32File(path) {
  let crc = 0xffffffff;
  for await (const chunk of createReadStream(path)) {
    for (const byte of chunk) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
