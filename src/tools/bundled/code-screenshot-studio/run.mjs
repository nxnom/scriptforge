import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
let raw = "";
for await (const chunk of process.stdin) raw += chunk;

try {
  const request = JSON.parse(raw);
  const input = validate(request.input ?? {});
  const outputName = "code-screenshot.png";
  const outputPath = join(request.outputDir, outputName);
  const args = [
    "--output",
    outputPath,
    "--language",
    input.language,
    "--theme",
    input.theme,
    "--background",
    input.background,
    "--pad-horiz",
    String(input.padding),
    "--pad-vert",
    String(input.padding),
    "--line-pad",
    "3",
    "--code-pad-right",
    "28",
  ];
  if (!input.lineNumbers) args.push("--no-line-number");
  if (!input.windowControls) args.push("--no-window-controls");
  if (input.title) args.push("--window-title", input.title);
  if (input.highlight) args.push("--highlight-lines", input.highlight);

  emit({ type: "log", level: "info", message: `Rendering ${input.language} code with Silicon` });
  emit({ type: "progress", value: 0.12, label: "Preparing code" });
  await runSilicon(args, input.code);
  const output = await stat(outputPath);
  emit({ type: "progress", value: 0.9, label: "Preparing PNG result" });
  emit({ type: "log", level: "success", message: `Created screenshot (${formatBytes(output.size)})` });
  emit({
    type: "result",
    outputs: [
      {
        path: outputName,
        name: outputName,
        mimeType: "image/png",
        metadata: { bytes: output.size, language: input.language, theme: input.theme },
      },
    ],
  });
  emit({ type: "progress", value: 1, label: "Complete" });
} catch (error) {
  const message = error instanceof Error ? error.message : "Silicon could not create the screenshot.";
  emit({ type: "log", level: "error", message });
  emit({ type: "failed", message });
  process.exitCode = 1;
}

function runSilicon(args, code) {
  return new Promise((resolve, reject) => {
    const child = spawn("silicon", args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => reject(new Error(`Could not start Silicon: ${error.message}`)));
    child.on("close", (status) => {
      if (status === 0) resolve();
      else reject(new Error(cleanError(stderr) || `Silicon exited with code ${status}.`));
    });
    child.stdin.end(code);
  });
}

function validate(input) {
  const code = String(input.code ?? "");
  if (!code.trim()) throw new Error("Paste some code first.");
  if (code.length > 40_000) throw new Error("Keep the code under 40,000 characters.");
  const language = safeToken(input.language, "txt", "Language");
  const theme = safeTheme(input.theme);
  const background = String(input.background ?? "#5468ff");
  if (!/^#[0-9a-fA-F]{3,8}$/.test(background)) throw new Error("Choose a valid background color.");
  const padding = Math.max(20, Math.min(180, Math.round(Number(input.padding) || 72)));
  const title = String(input.title ?? "")
    .trim()
    .slice(0, 100);
  const highlight = String(input.highlight ?? "").trim();
  if (highlight && !/^\d+(?:-\d+)?(?:;\d+(?:-\d+)?)*$/.test(highlight))
    throw new Error("Highlighted lines must look like 1;3-5.");
  return {
    code,
    language,
    theme,
    background,
    padding,
    title,
    highlight,
    lineNumbers: input.lineNumbers !== false,
    windowControls: input.windowControls !== false,
  };
}

function safeToken(value, fallback, label) {
  const token = String(value ?? fallback).trim();
  if (!/^[A-Za-z0-9_+#.-]{1,32}$/.test(token)) throw new Error(`${label} is invalid.`);
  return token;
}

function safeTheme(value) {
  const theme = String(value ?? "Dracula").trim();
  if (!/^[A-Za-z0-9 ()_.+-]{1,64}$/.test(theme)) throw new Error("Theme is invalid.");
  return theme;
}

function cleanError(value) {
  return value
    .replaceAll(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "")
    .trim()
    .slice(0, 800);
}

function formatBytes(value) {
  return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
}
