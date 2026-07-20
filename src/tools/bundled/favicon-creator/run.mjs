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
  const lightFile = request.files?.[0];
  const darkFile = request.input?.hasDark ? request.files?.[1] : undefined;
  if (!lightFile) throw new Error("Choose a light or default PNG, JPEG, or WebP image first.");
  if (request.input?.hasDark && !darkFile) throw new Error("Choose dark-mode artwork or turn off the dark variant.");

  const appName = cleanName(request.input?.appName) || "My App";
  const shortName = cleanName(request.input?.shortName) || appName.slice(0, 12);
  const fit = request.input?.fit === "contain" ? "contain" : "cover";
  const lightBackground = validColor(request.input?.lightBackground) ? request.input.lightBackground : "#ffffff";
  const darkBackground = validColor(request.input?.darkBackground) ? request.input.darkBackground : "#171717";
  const themeColor = validColor(request.input?.themeColor) ? request.input.themeColor : "#5468ff";
  const sources = { light: lightFile, dark: darkFile ?? lightFile };

  emit({ type: "log", level: "info", message: `Reading ${darkFile ? "light and dark artwork" : lightFile.name}` });
  emit({ type: "progress", value: 0.04, label: "Checking source artwork" });
  for (const [theme, file] of Object.entries(darkFile ? sources : { light: lightFile })) {
    const metadata = await sharp(file.path, { failOn: "error", limitInputPixels: 100_000_000 }).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`The ${theme} artwork is not a supported image.`);
    if (Math.min(metadata.width, metadata.height) < 256)
      throw new Error(`Use ${theme} artwork at least 256 × 256 pixels for a useful favicon pack.`);
  }

  const entries = [];
  const cache = new Map();
  const render = async (theme, size, options = {}) => {
    const { transparent = false, inset = 1 } = options;
    const background = theme === "dark" ? darkBackground : lightBackground;
    const key = `${theme}:${size}:${transparent}:${inset}:${fit}:${background}`;
    if (cache.has(key)) return cache.get(key);
    const dimension = Math.max(1, Math.round(size * inset));
    let artwork = sharp(sources[theme].path, { failOn: "error", limitInputPixels: 100_000_000 })
      .rotate()
      .resize({
        width: dimension,
        height: dimension,
        fit,
        position: "centre",
        background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : background,
      });
    if (!transparent) artwork = artwork.flatten({ background });
    let buffer = await artwork.png({ compressionLevel: 9 }).toBuffer();
    if (dimension !== size) {
      const position = Math.floor((size - dimension) / 2);
      buffer = await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : background,
        },
      })
        .composite([{ input: buffer, top: position, left: position }])
        .png({ compressionLevel: 9 })
        .toBuffer();
    }
    cache.set(key, buffer);
    return buffer;
  };
  const addText = (path, data) => entries.push({ path, data: Buffer.from(data) });
  const addPng = async (path, theme, size, options) => entries.push({ path, data: await render(theme, size, options) });

  const standardSizes = [16, 32, 48];
  for (const size of standardSizes) await addPng(`favicon-${size}x${size}.png`, "light", size);
  const icoFrames = await Promise.all(standardSizes.map((size) => render("light", size)));
  entries.push({ path: "favicon.ico", data: createIco(standardSizes, icoFrames) });
  emit({ type: "progress", value: 0.25, label: "Created browser favicons" });

  const lightSvgImage = (await render("light", 256, { transparent: true })).toString("base64");
  const darkSvgImage = (await render("dark", 256, { transparent: true })).toString("base64");
  addText("favicon.svg", adaptiveSvg(lightSvgImage, darkSvgImage, Boolean(darkFile), appName));
  if (darkFile) {
    for (const size of standardSizes) await addPng(`dark/favicon-${size}x${size}.png`, "dark", size);
    entries.push({
      path: "dark/favicon.ico",
      data: createIco(standardSizes, await Promise.all(standardSizes.map((size) => render("dark", size)))),
    });
  }
  emit({
    type: "progress",
    value: 0.42,
    label: darkFile ? "Created adaptive light and dark icons" : "Created adaptive SVG icon",
  });

  await addPng("apple-touch-icon.png", "light", 180);
  await addPng("apple-touch-icon-precomposed.png", "light", 180);
  const pinBuffer = await sharp(await render("light", 512, { transparent: true, inset: 0.88 }))
    .tint("#000000")
    .png()
    .toBuffer();
  addText("safari-pinned-tab.svg", pinnedTabSvg(pinBuffer.toString("base64"), appName));
  emit({ type: "progress", value: 0.56, label: "Created Apple browser assets" });

  await addPng("android-chrome-192x192.png", "light", 192);
  await addPng("android-chrome-512x512.png", "light", 512);
  await addPng("android-chrome-maskable-192x192.png", "light", 192, { inset: 0.8 });
  await addPng("android-chrome-maskable-512x512.png", "light", 512, { inset: 0.8 });
  addText(
    "site.webmanifest",
    `${JSON.stringify(webManifest(appName, shortName, themeColor, lightBackground), null, 2)}\n`,
  );
  emit({ type: "progress", value: 0.7, label: "Created Android and PWA assets" });

  await addPng("windows/mstile-70x70.png", "light", 70, { inset: 0.82 });
  await addPng("windows/mstile-144x144.png", "light", 144, { inset: 0.82 });
  await addPng("windows/mstile-150x150.png", "light", 150, { inset: 0.82 });
  await addPng("windows/mstile-310x310.png", "light", 310, { inset: 0.82 });
  const wideTile = await sharp({ create: { width: 310, height: 150, channels: 4, background: lightBackground } })
    .composite([{ input: await render("light", 120, { transparent: true }), top: 15, left: 95 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  entries.push({ path: "windows/mstile-310x150.png", data: wideTile });
  addText("browserconfig.xml", browserConfig(themeColor));
  emit({ type: "progress", value: 0.82, label: "Created Windows tile assets" });

  addText("HEAD-SNIPPET.html", headSnippet(themeColor, Boolean(darkFile)));
  addText("README.txt", readme(appName, Boolean(darkFile), fit, lightBackground, darkBackground, themeColor));
  emit({ type: "progress", value: 0.91, label: "Packing ZIP archive" });
  const outputName = "favicon-pack.zip";
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
        metadata: { bytes: archive.length, files: entries.length, darkVariant: Boolean(darkFile) },
      },
    ],
  });
  emit({ type: "progress", value: 1, label: "Complete" });
} catch (error) {
  fail(error instanceof Error ? error.message : "Favicon export failed.");
}

function cleanName(value) {
  return typeof value === "string"
    ? Array.from(value)
        .filter((character) => character >= " " && character !== "<" && character !== ">")
        .join("")
        .trim()
        .slice(0, 60)
    : "";
}

function validColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function adaptiveSvg(light, dark, hasDark, name) {
  const darkRules = hasDark
    ? `<image class="dark" width="256" height="256" href="data:image/png;base64,${dark}"/><style>.dark{display:none}@media(prefers-color-scheme:dark){.light{display:none}.dark{display:inline}}</style>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${escapeXml(name)}"><image class="light" width="256" height="256" href="data:image/png;base64,${light}"/>${darkRules}</svg>\n`;
}

function pinnedTabSvg(image, name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${escapeXml(name)}"><image width="512" height="512" href="data:image/png;base64,${image}"/></svg>\n`;
}

function webManifest(name, shortName, themeColor, backgroundColor) {
  return {
    name,
    short_name: shortName,
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/android-chrome-maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/android-chrome-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    theme_color: themeColor,
    background_color: backgroundColor,
    display: "standalone",
  };
}

function browserConfig(themeColor) {
  return `<?xml version="1.0" encoding="utf-8"?>\n<browserconfig>\n  <msapplication>\n    <tile>\n      <square70x70logo src="/windows/mstile-70x70.png"/>\n      <square150x150logo src="/windows/mstile-150x150.png"/>\n      <wide310x150logo src="/windows/mstile-310x150.png"/>\n      <square310x310logo src="/windows/mstile-310x310.png"/>\n      <TileColor>${themeColor}</TileColor>\n    </tile>\n  </msapplication>\n</browserconfig>\n`;
}

function headSnippet(themeColor, hasDark) {
  return `<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32">${hasDark ? '\n<link rel="icon" href="/dark/favicon-32x32.png" type="image/png" sizes="32x32" media="(prefers-color-scheme: dark)">' : ""}\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="mask-icon" href="/safari-pinned-tab.svg" color="${themeColor}">\n<link rel="manifest" href="/site.webmanifest">\n<meta name="msapplication-config" content="/browserconfig.xml">\n<meta name="theme-color" content="${themeColor}">\n`;
}

function readme(name, hasDark, fit, light, dark, theme) {
  return `FAVICON PACK — ${name}\n\nCopy this folder to your website's public root, then copy HEAD-SNIPPET.html into the <head> of each page. Adjust leading / paths if the site is hosted below a subpath.\n\nIncluded:\n- Browser: adaptive favicon.svg, favicon.ico, and 16/32/48 px PNG fallbacks\n- Apple: 180 px touch icons and a monochrome Safari pinned-tab SVG\n- Android/PWA: 192/512 px regular and maskable icons plus site.webmanifest\n- Windows: small, medium, wide, and large tiles plus browserconfig.xml\n${hasDark ? "- Dark mode: adaptive SVG plus dark PNG and ICO fallbacks in /dark\n" : "- Dark mode: no separate artwork supplied; the light/default artwork is used everywhere\n"}\nSettings: fit=${fit}, light background=${light}, dark background=${dark}, theme=${theme}\n\nThe pinned-tab asset is a monochrome raster silhouette wrapped in SVG; review it in Safari if brand-perfect vector edges are required. Browser and operating-system requirements evolve, so validate the pack against the platforms you ship. Generated locally by ScriptForge.\n`;
}

function createIco(sizes, frames) {
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  for (let index = 0; index < sizes.length; index += 1) {
    const entry = 6 + index * 16;
    header.writeUInt8(sizes[index] === 256 ? 0 : sizes[index], entry);
    header.writeUInt8(sizes[index] === 256 ? 0 : sizes[index], entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frames[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frames[index].length;
  }
  return Buffer.concat([header, ...frames]);
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
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
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
