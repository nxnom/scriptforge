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
{ "type": "result", "outputs": [{ "path": filename relative to outputDir, "name": string, "mimeType": string, "metadata"?: unknown }] }
{ "type": "failed", "message": string }

Write outputs inside request.outputDir. Revalidate all input in run.mjs. Emit useful startup, major-stage, completion, and failure logs. Emit result only after every declared output exists. Do not write non-event text to stdout; raw command output belongs on stderr.`;

export const uiBridgeGuide = `ui.html installs its message listener before sending:
parent.postMessage({ source: "scriptforge-tool", type: "ready" }, "*")

For every incoming event, require event.source === parent, event.data.source === "scriptforge-host", and a known message shape.

To run, send selected files as ArrayBuffer descriptors, never File objects:
parent.postMessage({ source: "scriptforge-tool", type: "run", input: {...}, files: [{ name, size, type, lastModified, data }] }, "*")

Bind running to an explicit button with type="button". Disable it and show loading immediately; restore it after failed or complete. Handle ready, accepted, progress { value, label }, log { level, message }, result { outputs }, failed { message }, and complete.

Result outputs provide relative previewUrl and downloadUrl. Render an appropriate image, video, audio, or metadata preview and an explicit save link. Add media load/error handlers so preview failures appear in the page and logs. Show bridge and runtime failures in the page, not only DevTools. Never use fetch, WebSocket, Node.js, direct filesystem APIs, or hard-coded hosts and ports.`;
