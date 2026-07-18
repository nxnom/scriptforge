export const toolManifestGuide = `{
  "schemaVersion": 1,
  "id": "lowercase-kebab-case-id",
  "version": "1.0.0",
  "name": "Human-readable name",
  "description": "One plain sentence",
  "category": "Files",
  "icon": "file",
  "script": "run.mjs",
  "interface": { "type": "html", "entry": "ui.html" },
  "requiredExecutables": []
}
requiredExecutables items are { "name": "ffmpeg", "version": ">= 7.0.0" }. Omit version when unnecessary. Never add installation commands.`;

export const runnerContractGuide = `run.mjs reads one JSON object from stdin:
{ "jobId": string, "input": unknown, "files": [{ "path": string, "name": string, "type": string, "size": number }], "outputDir": string }

Write newline-delimited JSON events to stdout:
{ "type": "log", "level": "info" | "success" | "warning" | "error", "message": string }
{ "type": "progress", "value": number from 0 to 1, "label"?: string }
{ "type": "result", "data"?: unknown, "outputs"?: [{ "path": filename relative to outputDir, "name": string, "mimeType": string, "metadata"?: unknown }] }
{ "type": "failed", "message": string }

Choose the result shape for the actual tool. Use data for information, live readings, analysis, or other results that do not naturally create a file. Use outputs only when the tool genuinely creates downloadable files; never invent snapshots or files merely to satisfy the contract. Write real file outputs inside request.outputDir. Revalidate all input in run.mjs. Emit useful startup, major-stage, completion, and failure logs. Emit result only after its data is ready and every declared output exists. Do not write non-event text to stdout; raw command output belongs on stderr.`;

export const uiStyleGuide = `Unless the user explicitly requests another visual style, make ui.html look native to ScriptForge:
- Use a compact dark theme with #151515 page background, #1d1d1d or #242424 surfaces, #343434 borders, near-white primary text, #929292 muted text, and white primary buttons with dark text. Use system-ui fonts.
- Treat the tester as a narrow utility panel, not a marketing page. Use a short 18-22px title and at most one brief description line. Do not add eyebrow labels, hero copy, oversized headings, decorative introductions, or repeated explanations.
- Use 12-16px outer padding, 8-12px gaps, compact controls, and restrained card padding. Avoid large empty areas. Keep file selection, essential controls, status, and the primary action visible in the first panel viewport whenever practical.
- Make the layout responsive down to 360px. Do not require horizontal scrolling. Avoid fixed page heights and large minimum heights; let only result collections grow and scroll when needed.
- An empty file picker may be a compact drop zone. As soon as files are selected, replace that empty drop zone in the same space with compact thumbnails or a file row plus Change/Add and Remove actions. Never keep a large Choose files area above a second duplicate selected-file preview.
- Reveal results in the existing layout or a compact section. Use a grid or list appropriate to the data, truncate long filenames, and keep primary result actions easy to reach.
- Show loading, progress, success, and failure without shifting the whole layout unnecessarily. Keep diagnostics and verbose logs collapsed unless they are needed.
Use ordinary CSS in ui.html; Tailwind is unavailable.`;

export const uiBridgeGuide = `ui.html installs its message listener before sending:
parent.postMessage({ source: "scriptforge-tool", type: "ready" }, "*")

For every incoming event, require event.source === parent, event.data.source === "scriptforge-host", and a known message shape.

To run, send selected files as ArrayBuffer descriptors, never File objects:
parent.postMessage({ source: "scriptforge-tool", type: "run", input: {...}, files: [] }, "*")

The files array may be empty for tools that do not consume local files. When files are selected, send ArrayBuffer descriptors { name, size, type, lastModified, data }, never File objects.

Bind running to an explicit button with type="button". Disable it and show loading immediately; restore it after failed or complete. Handle ready, accepted, progress { value, label }, log { level, message }, result { data?, outputs? }, failed { message }, and complete.

When outputs exist, they provide relative previewUrl and downloadUrl; render only actions appropriate for those real files. For data results, update the dashboard, reading, table, chart, status, or metadata view that fits the tool. Add media load/error handlers when media outputs exist. Show bridge and runtime failures in the page, not only DevTools. Never use fetch, WebSocket, Node.js, direct filesystem APIs, or hard-coded hosts and ports.`;
