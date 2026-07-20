export const toolManifestGuide = `{
  "schemaVersion": 1,
  "id": "lowercase-kebab-case-id",
  "version": "1.0.0",
  "name": "Human-readable name",
  "description": "One plain sentence",
  "categories": ["<primary purpose category>"],
  "icon": "file",
  "script": "run.mjs",
  "interface": { "type": "html", "entry": "ui.html" },
  "requiredExecutables": [],
  "configuration": []
}
requiredExecutables items are { "name": "ffmpeg", "version": ">= 7.0.0" }. Omit version when unnecessary. Never add installation commands. Declarations power readiness checks and Doctor guidance; the trusted runner itself has normal Node.js process permissions.

The angle-bracketed category above is a placeholder and must be replaced. categories contains one to three short user-facing category names. Prefer one or two. Choose the primary category from the tool's main user outcome and result domain. Reuse a category from the existing ScriptForge category list only when it is genuinely as accurate; create a new category when none is suitable. Accuracy is more important than reuse. Never add a loosely related category merely because it already exists or to reach the limit. A text-to-speech tool is Audio, not Files; Files is for general file management such as renaming, moving, or organizing.

configuration contains persistent values needed across runs. Fields share { "key": lowerCamelCase, "label": string, "description"?: string, "required": boolean } and use one of:
{ "type": "text" | "textarea", "placeholder"?: string, "defaultValue"?: string }
{ "type": "secret", "placeholder"?: string }
{ "type": "number", "minimum"?: number, "maximum"?: number, "defaultValue"?: number }
{ "type": "boolean", "defaultValue"?: boolean }
{ "type": "select", "options": [{ "value": string, "label": string }], "defaultValue"?: string }
Secret fields never have defaults. Use configuration for credentials, account identifiers, endpoints, and stable preferences reused across runs. Keep files and choices that naturally change per run in ui.html input. Never ask for a secret in ui.html, the kickoff panel, or the Codex terminal; ScriptForge renders and stores configuration itself.`;

export const runnerContractGuide = `run.mjs reads one JSON object from stdin:
{ "jobId": string, "input": unknown, "files": [{ "path": string, "name": string, "type": string, "size": number }], "outputDir": string, "config": object }

Write newline-delimited JSON events to stdout:
{ "type": "log", "level": "info" | "success" | "warning" | "error", "message": string }
{ "type": "progress", "value": number from 0 to 1, "label"?: string }
{ "type": "result", "data"?: unknown, "outputs"?: [{ "path": filename relative to outputDir, "name": string, "mimeType": string, "metadata"?: unknown }] }
{ "type": "failed", "message": string }

Choose the result shape for the actual tool. Use data for information, live readings, analysis, or other results that do not naturally create a file. Use outputs only when the tool genuinely creates downloadable files; never invent snapshots or files merely to satisfy the contract. Write real file outputs inside request.outputDir. Read persistent configuration only from request.config. Revalidate input and configuration in run.mjs. Never log configuration secrets or include them in results or output files. Emit useful startup, major-stage, completion, and failure logs. Emit result only after its data is ready and every declared output exists. Do not write non-event text to stdout; raw command output belongs on stderr.

Tool runners are trusted local Node.js programs. They may use network services, invoke local processes, and read, create, modify, move, or delete files anywhere available to the current operating-system user. Prefer direct in-place results when that is the purpose of the tool instead of forcing a copied-input or ZIP-download workflow. Reconfirm the concrete targets immediately before destructive deletion or overwrite.`;

export const uiStyleGuide = `Unless the user explicitly requests another visual style, make ui.html look native to ScriptForge:
- The iframe is same-origin, has no sandbox attribute, and receives no restrictive Content Security Policy. It may use fetch, WebSocket, ScriptForge APIs, remote modules, CDNs, workers, frames, media devices, browser filesystem pickers, and other browser capabilities. Pin important remote dependencies when practical and verify redistribution licenses for assets shipped inside the tool.
- Use a compact dark theme with #151515 page background, #1d1d1d or #242424 surfaces, #343434 borders, near-white primary text, #929292 muted text, and #5468ff primary buttons and focus accents with white text. Use #6375ff for hover and #3949bf for pressed states. Use system-ui fonts.
- The same interface appears in both a 420-620px Forge tester and a much wider installed Tool page. Build one fluid utility workspace that uses the full available iframe width at both sizes. Do not put the whole interface inside a centered max-width wrapper and do not horizontally or vertically center the entire app in a large empty canvas.
- Start CSS with border-box sizing and make html, body, and the root workspace width: 100%, min-width: 0, and min-height: 100%. Remove the default body margin. The root may use min-height: 100vh, but do not give controls or content panels fixed viewport heights.
- Use a short 18-22px title and at most one brief description line. Do not add eyebrow labels, hero copy, oversized headings, decorative introductions, or repeated explanations.
- Use 12-16px outer padding, 8-12px gaps, compact controls, and restrained card padding. Keep file selection, essential controls, current status, and the primary action visible in the first panel viewport whenever practical.
- Choose a layout that fits the tool instead of defaulting to one centered form card. If the tool has inputs and a meaningful preview/result, use a stacked layout in the narrow tester and a balanced side-by-side or dashboard layout on wide canvases. If it has only one compact control group, keep that group readable but let status, history, results, or details use the remaining width. Put empty messages inside their future result region so the rest of the page is not blank.
- Make the layout responsive down to 360px without horizontal scrolling. Use fluid grids with minmax(0, 1fr), allow controls to wrap, and add a deliberate breakpoint around 700-800px. Avoid fixed page heights, large minimum heights, and large empty areas; let only result collections grow or scroll when needed.
- An empty file picker may be a compact drop zone. As soon as files are selected, replace that empty drop zone in the same space with compact thumbnails or a file row plus Change/Add and Remove actions. Never keep a large Choose files area above a second duplicate selected-file preview.
- Give the tool an intentional information hierarchy: controls, current state, primary result, and secondary logs/details. Reveal results in the existing result region or a compact section. Use a grid, table, media preview, reading, or list appropriate to the data; truncate long filenames and keep primary result actions easy to reach.
- Show loading, progress, success, and failure without shifting the whole layout unnecessarily. Keep diagnostics and verbose logs collapsed unless they are needed.
- Before presenting the candidate, inspect the CSS as if the iframe were 480px wide and again at 1200px. At 480px nothing may clip or scroll horizontally; at 1200px the workspace must use the canvas intentionally rather than leaving a narrow centered island and unused space.
Use ordinary CSS in ui.html; Tailwind is unavailable.`;

export const uiBridgeGuide = `ui.html installs its message listener before sending:
parent.postMessage({ source: "scriptforge-tool", type: "ready" }, "*")

For every incoming event, require event.source === parent, event.data.source === "scriptforge-host", and a known message shape.

To run, send selected files as ArrayBuffer descriptors, never File objects:
parent.postMessage({ source: "scriptforge-tool", type: "run", input: {...}, files: [] }, "*")

The files array may be empty for tools that do not consume local files. When files are selected, send ArrayBuffer descriptors { name, size, type, lastModified, data }, never File objects.

Bind running to an explicit button with type="button". Disable it and show loading immediately; restore it after failed or complete. Handle ready, accepted, progress { value, label }, log { level, message }, result { data?, outputs? }, failed { message }, and complete.

The host grants clipboard-write permission to the iframe. A Copy action may call navigator.clipboard.writeText only from a direct user click. Keep a visible fallback that lets the user select and copy the same text if the browser or operating system still refuses clipboard access.

When outputs exist, they provide relative previewUrl and downloadUrl; render only actions appropriate for those real files. For data results, update the dashboard, reading, table, chart, status, or metadata view that fits the tool. Add media load/error handlers when media outputs exist. Show bridge and runtime failures in the page, not only DevTools. Network requests, WebSockets, same-origin ScriptForge APIs, remote resources, and browser filesystem APIs are allowed. Browser JavaScript still cannot import Node.js directly; delegate Node.js filesystem or process work to run.mjs.`;
