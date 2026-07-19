import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { degrees, PDFDocument, rgb } from "pdf-lib";
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
  const files = Array.isArray(request.files) ? request.files : [];
  const input = request.input ?? {};
  const pages = validatePages(input.pages, files.length);
  const outputMode = oneOf(input.outputMode, ["single", "split"], "single");
  const compression = oneOf(input.compression, ["none", "scan"], "none");
  if (compression === "scan" && outputMode !== "single") {
    throw new Error("Scan compression creates one PDF. Choose the combined output mode.");
  }

  emit({ type: "log", level: "info", message: `Preparing ${pages.length} page${pages.length === 1 ? "" : "s"}` });
  emit({ type: "progress", value: 0.08, label: "Reading source pages" });
  const originalBytes = [...new Set(pages.map((page) => page.fileIndex))].reduce(
    (total, index) => total + (files[index]?.size ?? 0),
    0,
  );

  const outputs =
    compression === "scan"
      ? [await createCompressedPdf({ files, pages, outputDir: request.outputDir, targetBytes: targetBytes(input) })]
      : await createEditablePdfs({ files, pages, outputDir: request.outputDir, outputMode });

  const outputBytes = outputs.reduce((total, output) => total + output.metadata.bytes, 0);
  emit({ type: "progress", value: 0.94, label: "Registering PDF output" });
  emit({
    type: "log",
    level: "success",
    message: `Created ${outputs.length} PDF file${outputs.length === 1 ? "" : "s"} (${formatBytes(outputBytes)})`,
  });
  emit({
    type: "result",
    outputs: outputs.map((output) => ({
      path: output.path,
      name: output.name,
      mimeType: "application/pdf",
      metadata: { ...output.metadata, originalBytes, compression },
    })),
  });
  emit({ type: "progress", value: 1, label: "Complete" });
} catch (error) {
  fail(error instanceof Error ? error.message : "The PDF operation failed.");
}

async function createEditablePdfs({ files, pages, outputDir, outputMode }) {
  const documents = new Map();
  for (const fileIndex of new Set(pages.filter((page) => page.kind === "pdf").map((page) => page.fileIndex))) {
    const file = files[fileIndex];
    if (!file) throw new Error("One of the selected PDF files is missing.");
    documents.set(fileIndex, await PDFDocument.load(await readBytes(file.path), { updateMetadata: false }));
  }

  if (outputMode === "split") {
    const outputs = [];
    for (const [index, page] of pages.entries()) {
      emit({ type: "progress", value: 0.12 + (index / pages.length) * 0.76, label: `Creating page ${index + 1}` });
      const document = await PDFDocument.create();
      await appendPage(document, page, files, documents);
      const bytes = await document.save({ useObjectStreams: true, addDefaultPage: false });
      const name = `page-${String(index + 1).padStart(3, "0")}.pdf`;
      await writeOutput(outputDir, name, bytes);
      outputs.push({ path: name, name, metadata: { bytes: bytes.byteLength, pages: 1 } });
    }
    return outputs;
  }

  const document = await PDFDocument.create();
  for (const [index, page] of pages.entries()) {
    emit({ type: "progress", value: 0.12 + (index / pages.length) * 0.7, label: `Copying page ${index + 1}` });
    await appendPage(document, page, files, documents);
  }
  const bytes = await document.save({ useObjectStreams: true, addDefaultPage: false });
  const name = `${safeStem(files[pages[0].fileIndex]?.name)}-edited.pdf`;
  await writeOutput(outputDir, name, bytes);
  return [{ path: name, name, metadata: { bytes: bytes.byteLength, pages: pages.length } }];
}

async function appendPage(document, page, files, documents) {
  if (page.kind === "pdf") {
    const source = documents.get(page.fileIndex);
    const [copied] = await document.copyPages(source, [page.pageIndex]);
    copied.setRotation(degrees(normalizeRotation(copied.getRotation().angle + page.rotation)));
    document.addPage(copied);
    return;
  }

  const file = files[page.fileIndex];
  if (!file) throw new Error("One of the selected images is missing.");
  const background = parseColor(page.background);
  const png = await sharp(file.path).rotate(page.rotation).flatten({ background }).png().toBuffer();
  const metadata = await sharp(png).metadata();
  const imageWidth = metadata.width ?? page.width;
  const imageHeight = metadata.height ?? page.height;
  const [pageWidth, pageHeight] = imagePageSize(page.pageSize, imageWidth, imageHeight);
  const outputPage = document.addPage([pageWidth, pageHeight]);
  outputPage.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(background.r / 255, background.g / 255, background.b / 255),
  });
  const margin = Math.min(page.margin, pageWidth / 3, pageHeight / 3);
  const availableWidth = Math.max(1, pageWidth - margin * 2);
  const availableHeight = Math.max(1, pageHeight - margin * 2);
  if (page.imageFit === "cover") {
    const fitted = await sharp(png)
      .resize(Math.max(1, Math.round(availableWidth * 2)), Math.max(1, Math.round(availableHeight * 2)), {
        fit: "cover",
        position: "centre",
      })
      .png()
      .toBuffer();
    const embedded = await document.embedPng(fitted);
    outputPage.drawImage(embedded, {
      x: margin,
      y: margin,
      width: availableWidth,
      height: availableHeight,
    });
    return;
  }
  const embedded = await document.embedPng(png);
  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  outputPage.drawImage(embedded, {
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });
}

function imagePageSize(size, width, height) {
  if (size === "a4") return height >= width ? [595.28, 841.89] : [841.89, 595.28];
  if (size === "letter") return height >= width ? [612, 792] : [792, 612];
  const scale = Math.min(1, 1440 / Math.max(width, height));
  return [Math.max(1, width * scale), Math.max(1, height * scale)];
}

async function createCompressedPdf({ files, pages, outputDir, targetBytes }) {
  const attempts = [
    { quality: 82, scale: 1 },
    { quality: 70, scale: 0.9 },
    { quality: 58, scale: 0.8 },
    { quality: 46, scale: 0.7 },
    { quality: 34, scale: 0.6 },
  ];
  let best;
  for (const [attemptIndex, attempt] of attempts.entries()) {
    emit({
      type: "progress",
      value: 0.14 + (attemptIndex / attempts.length) * 0.72,
      label: `Compressing at quality ${attempt.quality}`,
    });
    const document = await PDFDocument.create();
    for (const page of pages) {
      const raster = files[page.rasterFileIndex];
      if (!raster) throw new Error("A rendered page needed for scan compression is missing.");
      const metadata = await sharp(raster.path).metadata();
      const width = Math.max(1, Math.round((metadata.width ?? 1) * attempt.scale));
      const jpeg = await sharp(raster.path)
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality: attempt.quality, mozjpeg: true })
        .toBuffer();
      const image = await document.embedJpg(jpeg);
      const outputPage = document.addPage([page.width, page.height]);
      outputPage.drawImage(image, { x: 0, y: 0, width: page.width, height: page.height });
    }
    const bytes = await document.save({ useObjectStreams: true, addDefaultPage: false });
    best = { bytes, quality: attempt.quality, scale: attempt.scale };
    if (!targetBytes || bytes.byteLength <= targetBytes) break;
  }
  const name = `${safeStem(files[pages[0].fileIndex]?.name)}-compressed.pdf`;
  await writeOutput(outputDir, name, best.bytes);
  return {
    path: name,
    name,
    metadata: {
      bytes: best.bytes.byteLength,
      pages: pages.length,
      targetBytes,
      targetMet: targetBytes ? best.bytes.byteLength <= targetBytes : undefined,
      quality: best.quality,
      scale: best.scale,
      flattened: true,
    },
  };
}

function validatePages(value, fileCount) {
  if (!Array.isArray(value) || value.length < 1) throw new Error("Keep at least one page.");
  return value.map((page, index) => {
    const fileIndex = integer(page?.fileIndex, 0, fileCount - 1, `Page ${index + 1} file`);
    const pageIndex = integer(page?.pageIndex, 0, 99_999, `Page ${index + 1} number`);
    const rotation = oneOf(Number(page?.rotation), [0, 90, 180, 270], 0);
    const width = finite(page?.width, 1, 20_000, `Page ${index + 1} width`);
    const height = finite(page?.height, 1, 20_000, `Page ${index + 1} height`);
    const rasterFileIndex =
      page?.rasterFileIndex === undefined
        ? -1
        : integer(page.rasterFileIndex, 0, fileCount - 1, `Page ${index + 1} raster`);
    const kind = oneOf(page?.kind, ["pdf", "image"], "pdf");
    const pageSize = oneOf(page?.pageSize, ["image", "a4", "letter"], "a4");
    const imageFit = oneOf(page?.imageFit, ["contain", "cover"], "contain");
    const margin = finite(page?.margin ?? 24, 0, 300, `Page ${index + 1} margin`);
    const background = /^#[0-9a-f]{6}$/i.test(page?.background) ? page.background : "#ffffff";
    return {
      kind,
      fileIndex,
      pageIndex,
      rotation,
      width,
      height,
      rasterFileIndex,
      pageSize,
      imageFit,
      margin,
      background,
    };
  });
}

function parseColor(value) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "ffffff";
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    alpha: 1,
  };
}

function targetBytes(input) {
  if (input.targetMb === undefined || input.targetMb === null || input.targetMb === "") return undefined;
  return Math.round(finite(input.targetMb, 0.1, 100, "Target size") * 1024 * 1024);
}

function integer(value, min, max, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${label} is invalid.`);
  return number;
}

function finite(value, min, max, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max)
    throw new Error(`${label} must be between ${min} and ${max}.`);
  return number;
}

function oneOf(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

function normalizeRotation(value) {
  return ((value % 360) + 360) % 360;
}

function safeStem(name = "document.pdf") {
  return basename(name, extname(name)).replace(/[^a-zA-Z0-9_-]+/g, "-") || "document";
}

async function readBytes(path) {
  return readFile(path);
}

async function writeOutput(directory, name, bytes) {
  await writeFile(join(directory, name), bytes);
}

function formatBytes(value) {
  return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
}
