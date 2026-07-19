import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
const fail = (message) => {
  emit({ type: "log", level: "error", message });
  emit({ type: "failed", message });
  process.exitCode = 1;
};
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  return current >>> 0;
});

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

try {
  const request = JSON.parse(raw);
  const file = request.files?.[0];
  if (!file) throw new Error("Choose a PNG, JPEG, or WebP image first.");

  const selected = normalizePlatforms(request.input?.platforms);
  const fit = request.input?.fit === "contain" ? "contain" : "cover";
  const background = validColor(request.input?.background) ? request.input.background : "#ffffff";
  const androidScale = boundedNumber(request.input?.androidScale, 0.45, 1, 0.62);
  emit({ type: "log", level: "info", message: `Reading ${file.name}` });
  emit({ type: "progress", value: 0.05, label: "Checking source image" });

  const source = sharp(file.path, { failOn: "error", limitInputPixels: 100_000_000 }).rotate();
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) throw new Error("The selected file is not a supported image.");
  if (Math.min(metadata.width, metadata.height) < 512)
    throw new Error("Use an image at least 512 × 512 pixels for useful app icons.");

  const entries = [];
  const cache = new Map();
  const render = async (size, transparent = false, inset = 0) => {
    const key = `${size}:${transparent}:${inset}:${fit}:${background}`;
    if (cache.has(key)) return cache.get(key);
    const dimension = inset ? Math.round(size * inset) : size;
    let image = sharp(file.path, { failOn: "error", limitInputPixels: 100_000_000 })
      .rotate()
      .resize({
        width: dimension,
        height: dimension,
        fit,
        position: "centre",
        background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : background,
      });
    if (inset) {
      const top = Math.floor((size - dimension) / 2);
      const left = Math.floor((size - dimension) / 2);
      image = sharp({
        create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      }).composite([{ input: await image.png().toBuffer(), top, left }]);
    } else if (!transparent) image = image.flatten({ background });
    const buffer = await image.png({ compressionLevel: 9 }).toBuffer();
    cache.set(key, buffer);
    return buffer;
  };
  const addJson = (path, value) => entries.push({ path, data: Buffer.from(`${JSON.stringify(value, null, 2)}\n`) });
  const addText = (path, value) => entries.push({ path, data: Buffer.from(value) });
  const addAppleSet = async (folder, images, info = {}) => {
    const records = [];
    for (const image of images) {
      const filename = `${image.id}-${image.pixels}.png`;
      entries.push({ path: `${folder}/${filename}`, data: await render(image.pixels) });
      records.push({ filename, idiom: image.idiom, scale: image.scale, size: image.size, ...image.extra });
    }
    addJson(`${folder}/Contents.json`, { images: records, info: { author: "scriptforge", version: 1 }, ...info });
  };

  let completed = 0;
  const progress = (label) => {
    completed += 1;
    emit({ type: "progress", value: 0.1 + (completed / selected.length) * 0.76, label });
  };

  if (selected.includes("iphone")) {
    await addAppleSet("Apple/iPhone/AppIcon.appiconset", iphoneImages());
    progress("Created iPhone icons");
  }
  if (selected.includes("ipad")) {
    await addAppleSet("Apple/iPad/AppIcon.appiconset", ipadImages());
    progress("Created iPad icons");
  }
  if (selected.includes("macos")) {
    await addAppleSet("Apple/macOS/AppIcon.appiconset", macImages());
    progress("Created macOS icons");
  }
  if (selected.includes("watchos")) {
    await addAppleSet("Apple/watchOS/AppIcon.appiconset", watchImages());
    progress("Created watchOS icons");
  }
  if (selected.includes("android")) {
    const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
    for (const [density, size] of Object.entries(densities)) {
      entries.push({ path: `Android/app/src/main/res/mipmap-${density}/ic_launcher.png`, data: await render(size) });
      entries.push({
        path: `Android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`,
        data: await render(Math.round(size * 2.25), true, androidScale),
      });
    }
    entries.push({ path: "Android/play-store-icon-512.png", data: await render(512) });
    addText(
      "Android/app/src/main/res/values/colors.xml",
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="ic_launcher_background">${background}</color>\n</resources>\n`,
    );
    const adaptive = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/ic_launcher_background"/>\n  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`;
    addText("Android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml", adaptive);
    addText(
      "Android/README.txt",
      "Copy the res folders into your Android app module. The pack includes legacy launcher PNGs, an adaptive foreground, a background color, and a 512 px Play Store image.\n",
    );
    progress("Created Android icons");
  }
  if (selected.includes("icon-composer")) {
    entries.push({ path: "Apple/Icon Composer Source/artwork-1024.png", data: await render(1024) });
    entries.push({ path: "Apple/Icon Composer Source/artwork-watch-1088.png", data: await render(1088) });
    addText(
      "Apple/Icon Composer Source/README.txt",
      "LIQUID GLASS / ICON COMPOSER SOURCE\n\nThese are prepared flattened source images, not a fabricated .icon file. Open Apple Icon Composer, create a new icon, add the appropriate 1024 × 1024 artwork (or 1088 × 1088 for Apple Watch), build any foreground/background layers you want, preview the Liquid Glass treatments, then save the real editable .icon document from Icon Composer.\n\nA flattened source cannot preserve the layers and materials required by the .icon format.\n",
    );
    progress("Prepared Icon Composer source");
  }

  addText("README.txt", summary(selected, metadata, fit, background));
  emit({ type: "progress", value: 0.9, label: "Packing ZIP archive" });
  const outputName = "app-icon-export.zip";
  const archive = createZip(entries);
  await writeFile(join(request.outputDir, outputName), archive);
  emit({ type: "log", level: "success", message: `Packed ${entries.length} files into ${outputName}` });
  emit({
    type: "result",
    outputs: [
      {
        path: outputName,
        name: outputName,
        mimeType: "application/zip",
        metadata: { bytes: archive.length, files: entries.length, platforms: selected },
      },
    ],
  });
  emit({ type: "progress", value: 1, label: "Complete" });
} catch (error) {
  fail(error instanceof Error ? error.message : "App icon export failed.");
}

function normalizePlatforms(value) {
  const supported = ["iphone", "ipad", "macos", "watchos", "android", "icon-composer"];
  const values = Array.isArray(value) ? value.filter((item) => supported.includes(item)) : [];
  if (!values.length) throw new Error("Select at least one export platform.");
  return [...new Set(values)];
}

function validColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function boundedNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : fallback;
}

function scaleImages(idiom, points, marketing = true) {
  const images = points.flatMap(([size, scales]) =>
    scales.map((scale) => ({
      id: `${size}x${size}@${scale}`,
      idiom,
      size: `${size}x${size}`,
      scale: `${scale}x`,
      pixels: Math.round(size * scale),
    })),
  );
  if (marketing) images.push({ id: "marketing", idiom: "ios-marketing", size: "1024x1024", scale: "1x", pixels: 1024 });
  return images;
}

function iphoneImages() {
  return scaleImages("iphone", [
    [20, [2, 3]],
    [29, [2, 3]],
    [40, [2, 3]],
    [60, [2, 3]],
  ]);
}
function ipadImages() {
  return scaleImages("ipad", [
    [20, [1, 2]],
    [29, [1, 2]],
    [40, [1, 2]],
    [76, [1, 2]],
    [83.5, [2]],
  ]);
}
function macImages() {
  return scaleImages(
    "mac",
    [
      [16, [1, 2]],
      [32, [1, 2]],
      [128, [1, 2]],
      [256, [1, 2]],
      [512, [1, 2]],
    ],
    false,
  );
}
function watchImages() {
  return [
    {
      id: "notification-38",
      idiom: "watch",
      size: "24x24",
      scale: "2x",
      pixels: 48,
      extra: { role: "notificationCenter", subtype: "38mm" },
    },
    {
      id: "notification-42",
      idiom: "watch",
      size: "27.5x27.5",
      scale: "2x",
      pixels: 55,
      extra: { role: "notificationCenter", subtype: "42mm" },
    },
    {
      id: "companion-2x",
      idiom: "watch",
      size: "29x29",
      scale: "2x",
      pixels: 58,
      extra: { role: "companionSettings" },
    },
    {
      id: "companion-3x",
      idiom: "watch",
      size: "29x29",
      scale: "3x",
      pixels: 87,
      extra: { role: "companionSettings" },
    },
    {
      id: "launcher-38",
      idiom: "watch",
      size: "40x40",
      scale: "2x",
      pixels: 80,
      extra: { role: "appLauncher", subtype: "38mm" },
    },
    {
      id: "long-look-42",
      idiom: "watch",
      size: "44x44",
      scale: "2x",
      pixels: 88,
      extra: { role: "longLook", subtype: "42mm" },
    },
    {
      id: "quick-look-38",
      idiom: "watch",
      size: "86x86",
      scale: "2x",
      pixels: 172,
      extra: { role: "quickLook", subtype: "38mm" },
    },
    {
      id: "quick-look-42",
      idiom: "watch",
      size: "98x98",
      scale: "2x",
      pixels: 196,
      extra: { role: "quickLook", subtype: "42mm" },
    },
    { id: "marketing", idiom: "watch-marketing", size: "1024x1024", scale: "1x", pixels: 1024 },
  ];
}

function summary(platforms, metadata, fit, background) {
  return `APP ICON EXPORT\n\nSource: ${metadata.width} × ${metadata.height} ${metadata.format ?? "image"}\nPlatforms: ${platforms.join(", ")}\nFit: ${fit}\nBackground: ${background}\n\nGenerated locally by ScriptForge. Review platform requirements in the current Xcode and Android Studio versions before release submission.\n`;
}

function createZip(entries) {
  const files = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path.replaceAll("\\", "/"));
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    files.push(local, name, data);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt32LE(checksum, 16);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, ...central, end]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
