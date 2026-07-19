import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
let lastProgress = 0;
const progress = (value, label) => {
  lastProgress = Math.max(lastProgress, Math.max(0, Math.min(1, Number(value) || 0)));
  emit({ type: "progress", value: lastProgress, label });
};
const fail = (message) => {
  emit({ type: "log", level: "error", message });
  emit({ type: "failed", message });
  process.exitCode = 1;
};

let child;
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  return current >>> 0;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    child?.kill(signal);
    emit({ type: "log", level: "warning", message: "Download cancelled." });
    process.exitCode = 130;
  });
}

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

try {
  const request = JSON.parse(raw);
  const input = normalizeInput(request.input);
  const downloadDir = join(request.outputDir, "downloads");
  await mkdir(downloadDir, { recursive: true });

  emit({ type: "log", level: "info", message: "Checking the video address with yt-dlp." });
  progress(0.02, "Connecting");

  const args = buildArguments(input);
  const result = await runYtDlp(args, downloadDir);
  if (result.code !== 0) {
    const reason = friendlyFailure(result.diagnostics);
    throw new Error(reason);
  }

  const files = await listFiles(downloadDir);
  if (!files.length) throw new Error("yt-dlp finished without creating a downloadable file.");

  progress(0.91, files.length > 1 ? "Packing playlist ZIP" : "Preparing download");
  const outputs = [];
  if (files.length === 1) {
    const file = files[0];
    outputs.push({
      path: `downloads/${file.name}`,
      name: file.name,
      mimeType: mimeType(file.name),
      metadata: { bytes: file.size, files: 1, playlist: false },
    });
  } else {
    const archiveName = "video-playlist.zip";
    const archivePath = join(request.outputDir, archiveName);
    const bytes = await createStoredZip(files, archivePath, (value) =>
      progress(0.91 + value * 0.07, "Packing playlist ZIP"),
    );
    outputs.push({
      path: archiveName,
      name: archiveName,
      mimeType: "application/zip",
      metadata: { bytes, files: files.length, playlist: true },
    });
    await rm(downloadDir, { recursive: true, force: true });
  }

  emit({
    type: "log",
    level: "success",
    message: files.length === 1 ? `Saved ${files[0].name}` : `Packed ${files.length} downloads into one ZIP archive.`,
  });
  emit({ type: "result", outputs });
  progress(1, "Complete");
} catch (error) {
  fail(error instanceof Error ? error.message : "The download failed.");
}

function normalizeInput(value) {
  if (value?.authorized !== true) throw new Error("Confirm that you are allowed to save this content.");
  const url = typeof value?.url === "string" ? value.url.trim() : "";
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Enter a complete video or playlist URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("Only HTTP and HTTPS video addresses are supported.");
  if (parsed.username || parsed.password) throw new Error("Remove usernames or passwords from the video address.");

  const qualities = new Set(["best", "1080", "720", "480", "small", "audio"]);
  const quality = qualities.has(value?.quality) ? value.quality : "best";
  const playlist = value?.playlist === true;
  const start = optionalPositiveInteger(value?.playlistStart, "playlist start");
  const end = optionalPositiveInteger(value?.playlistEnd, "playlist end");
  if (!playlist && (start || end)) throw new Error("Enable playlist download before choosing a playlist range.");
  if (start && end && start > end) throw new Error("Playlist start must be before playlist end.");
  return { url: parsed.href, quality, playlist, start, end };
}

function optionalPositiveInteger(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${label} must be a positive whole number.`);
  return number;
}

function buildArguments(input) {
  const formats = {
    best: "best[vcodec!=none][acodec!=none][ext=mp4]/best[vcodec!=none][acodec!=none]",
    1080: "best[height<=1080][vcodec!=none][acodec!=none][ext=mp4]/best[height<=1080][vcodec!=none][acodec!=none]",
    720: "best[height<=720][vcodec!=none][acodec!=none][ext=mp4]/best[height<=720][vcodec!=none][acodec!=none]",
    480: "best[height<=480][vcodec!=none][acodec!=none][ext=mp4]/best[height<=480][vcodec!=none][acodec!=none]",
    small: "worst[vcodec!=none][acodec!=none][ext=mp4]/worst[vcodec!=none][acodec!=none]",
    audio: "bestaudio[vcodec=none][acodec!=none]",
  };
  const args = [
    "--no-config",
    "--newline",
    "--no-colors",
    "--no-part",
    "--restrict-filenames",
    "--trim-filenames",
    "140",
    "--windows-filenames",
    "--format",
    formats[input.quality],
    "--progress-template",
    "download:SF_PROGRESS:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(info.playlist_index|1)s|%(info.playlist_count|1)s",
    "--output",
    "%(playlist_index&{}- |)s%(title).140B-%(id)s.%(ext)s",
  ];
  if (input.playlist) {
    args.push("--yes-playlist");
    if (input.start || input.end) args.push("--playlist-items", `${input.start ?? 1}:${input.end ?? ""}`);
  } else {
    args.push("--no-playlist");
  }
  args.push("--", input.url);
  return args;
}

async function runYtDlp(args, cwd) {
  return await new Promise((resolve, reject) => {
    const diagnostics = [];
    let stdoutBuffer = "";
    let stderrBuffer = "";
    child = spawn("yt-dlp", args, { cwd, env: process.env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    child.once("error", (error) =>
      reject(new Error(error.code === "ENOENT" ? "yt-dlp is not installed." : "yt-dlp could not start.")),
    );
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      stdoutBuffer = drainLines(stdoutBuffer, (line) => handleProgress(line));
    });
    child.stderr.on("data", (chunk) => {
      stderrBuffer += chunk;
      stderrBuffer = drainLines(stderrBuffer, (line) => {
        const safe = sanitizeDiagnostic(line);
        if (safe) diagnostics.push(safe);
        if (diagnostics.length > 12) diagnostics.shift();
      });
    });
    child.once("close", (code) => {
      handleProgress(stdoutBuffer.trim());
      const tail = sanitizeDiagnostic(stderrBuffer);
      if (tail) diagnostics.push(tail);
      child = undefined;
      resolve({ code, diagnostics });
    });
  });
}

function drainLines(buffer, visit) {
  const lines = buffer.split(/\r?\n/);
  for (const line of lines.slice(0, -1)) visit(line);
  return lines.at(-1) ?? "";
}

function handleProgress(line) {
  if (!line.startsWith("SF_PROGRESS:")) return;
  const [percentText, speed, eta, index, count] = line.slice(12).split("|");
  const percent = Number.parseFloat(percentText?.replace("%", ""));
  const itemIndex = Number.parseInt(index, 10) || 1;
  const itemCount = Number.parseInt(count, 10) || 1;
  const itemFraction = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) / 100 : 0;
  const overall = Math.min(0.88, 0.05 + ((itemIndex - 1 + itemFraction) / Math.max(itemCount, itemIndex)) * 0.83);
  const details = [
    itemCount > 1 ? `${itemIndex}/${itemCount}` : "",
    speed && speed !== "NA" ? speed.trim() : "",
    eta && eta !== "NA" ? `ETA ${eta.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  progress(overall, details ? `Downloading · ${details}` : "Downloading");
}

function sanitizeDiagnostic(value) {
  return String(value)
    .replace(/https?:\/\/\S+/gi, "[video address]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

function friendlyFailure(lines) {
  const text = lines.join(" ").toLowerCase();
  if (text.includes("unsupported url")) return "That site or video address is not supported by this yt-dlp version.";
  if (text.includes("private video") || text.includes("sign in") || text.includes("login"))
    return "This video requires account access that the local downloader does not have.";
  if (text.includes("video unavailable") || text.includes("not available"))
    return "The video is unavailable or restricted in this location.";
  if (text.includes("requested format is not available"))
    return "The selected quality is not available for this video. Try Best available.";
  if (text.includes("copyright")) return "The platform refused this download because of a content restriction.";
  return "yt-dlp could not download this address. Check that it is public, available, and supported, then try again.";
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.endsWith(".part") || entry.name.endsWith(".ytdl")) continue;
    const path = join(directory, entry.name);
    const details = await stat(path);
    files.push({ path, name: entry.name, size: details.size });
  }
  return files.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
}

function mimeType(name) {
  const extension = name.toLowerCase().split(".").at(-1);
  return (
    {
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      mkv: "video/x-matroska",
      m4a: "audio/mp4",
      mp3: "audio/mpeg",
      opus: "audio/ogg",
      ogg: "audio/ogg",
    }[extension] ?? "application/octet-stream"
  );
}

async function createStoredZip(files, outputPath, onProgress) {
  const maximum = 0xffffffff;
  if (files.length > 0xffff) throw new Error("This playlist contains too many files for one classic ZIP archive.");
  let localSize = 0;
  let centralSize = 0;
  let inputBytes = 0;
  for (const file of files) {
    const nameLength = Buffer.byteLength(basename(file.name));
    if (nameLength > 0xffff) throw new Error("A downloaded filename is too long for the ZIP archive.");
    if (file.size > maximum) throw new Error("A downloaded file is too large for this classic ZIP archive.");
    localSize += 30 + nameLength + file.size;
    centralSize += 46 + nameLength;
    inputBytes += file.size;
  }
  if (localSize > maximum || centralSize > maximum || localSize + centralSize + 22 > maximum) {
    throw new Error("This playlist is too large for one classic ZIP archive.");
  }

  const prepared = [];
  let offset = 0;
  let processedBytes = 0;
  const reportBytes = (bytes) => {
    processedBytes += bytes;
    onProgress?.(inputBytes ? Math.min(1, processedBytes / (inputBytes * 2)) : 1);
  };
  for (const file of files) {
    const checksum = await crc32File(file.path, reportBytes);
    const name = Buffer.from(basename(file.name));
    const local = localHeader(name.length, file.size, checksum);
    prepared.push({ ...file, nameBuffer: name, checksum, offset });
    offset += local.length + name.length + file.size;
  }

  const output = createWriteStream(outputPath, { flags: "wx" });
  try {
    for (const file of prepared) {
      await write(output, localHeader(file.nameBuffer.length, file.size, file.checksum));
      await write(output, file.nameBuffer);
      for await (const chunk of createReadStream(file.path)) {
        await write(output, chunk);
        reportBytes(chunk.length);
      }
    }
    const centralOffset = offset;
    for (const file of prepared) {
      await write(output, centralHeader(file.nameBuffer.length, file.size, file.checksum, file.offset));
      await write(output, file.nameBuffer);
      offset += 46 + file.nameBuffer.length;
    }
    const centralSize = offset - centralOffset;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(prepared.length, 8);
    end.writeUInt16LE(prepared.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(centralOffset, 16);
    await write(output, end);
    await close(output);
    return offset + end.length;
  } catch (error) {
    output.destroy();
    await rm(outputPath, { force: true });
    throw error;
  }
}

function localHeader(nameLength, size, checksum) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(nameLength, 26);
  return header;
}

function centralHeader(nameLength, size, checksum, offset) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(size, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(nameLength, 28);
  header.writeUInt32LE(offset, 42);
  return header;
}

async function crc32File(path, onBytes) {
  let crc = 0xffffffff;
  for await (const chunk of createReadStream(path)) {
    for (const byte of chunk) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    onBytes?.(chunk.length);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function write(stream, data) {
  await new Promise((resolve, reject) => {
    stream.write(data, (error) => (error ? reject(error) : resolve()));
  });
}

async function close(stream) {
  await new Promise((resolve, reject) => {
    stream.once("error", reject);
    stream.end(resolve);
  });
}
