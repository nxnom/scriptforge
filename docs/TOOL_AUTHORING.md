# Tool Authoring Contract

This document records the interface contract that Codex must follow when it forges a ScriptForge tool. Its operational rules are mirrored directly into the Forge initialization instructions in `src/mcp`; update both whenever this contract changes.

## Package shape

Each tool contains:

- `tool.json` — metadata, entrypoint, accepted inputs, outputs, and required executable names.
- An execution script — reads one JSON request from standard input and writes newline-delimited JSON lifecycle events to standard output.
- `ui.html` — a self-contained plain HTML, CSS, and JavaScript interface.

Generated interfaces do not use React, GeckoUI, npm packages, or direct Node.js APIs. They run in a sandboxed iframe without direct filesystem or network access.

## Host bridge

The interface and ScriptForge shell communicate only with `window.postMessage`.

1. After installing all message listeners, the tool posts `{ source: "scriptforge-tool", type: "ready" }` to its parent.
2. The host responds with `{ source: "scriptforge-host", type: "ready" }`.
3. A user action posts a `run` message containing validated input and a files array. The array may be empty for tools without file input.
4. The host acknowledges the request with `accepted`, starts the job through the REST API, and forwards job events over the bridge.
5. The interface renders `progress`, `log`, `result`, `failed`, and `complete` events.

Always verify `event.source`, the message `source`, and the message shape. Do not interpret arbitrary iframe or window messages as tool events.

## User actions and files

- Bind execution to an explicit button click with `type="button"`, or deliberately disable native form validation before relying on a form `submit` handler. Native constraint validation can prevent `submit` from firing without producing an application error.
- Do not send `File` objects directly across the sandbox boundary. When a tool uses files, read each selected file with `arrayBuffer()` and send a descriptor containing `name`, `size`, `type`, `lastModified`, and `data`. Send `files: []` when the tool does not use files.
- Disable the action while a run is active and restore it after either `complete` or `failed`.
- Surface bridge and runtime failures inside the interface, not only in DevTools.

## Output previews

- The host returns same-origin `previewUrl` and `downloadUrl` values for approved job outputs.
- Assign `previewUrl` to an appropriate `<img>`, `<video>`, or `<audio>` element. Assign `downloadUrl` to an explicit save link.
- Keep output URLs relative. ScriptForge can run directly on its local server or through a development proxy, so a tool must not hard-code a host or port.
- The iframe content policy allows same-origin images and media plus `blob:` and `data:` previews. It intentionally keeps `connect-src 'none'`; tool JavaScript must never fetch ScriptForge APIs directly.
- Add media `load` and `error` handlers so a failed preview becomes a visible message and log entry.

## Lifecycle events and logs

Execution scripts must emit useful structured events so the interface can show what is happening:

```json
{"type":"log","level":"info","message":"Reading image metadata"}
{"type":"progress","value":0.35,"label":"Resizing image"}
{"type":"result","outputs":[{"path":"resized.png","name":"resized.png","mimeType":"image/png","metadata":{}}]}
```

Rules:

- Emit progress values from `0` through `1` with short user-facing labels.
- Log meaningful stages, decisions, warnings, and failures. Never log secrets or raw file contents.
- Write machine-readable events to standard output. Treat unstructured standard output and standard error as diagnostic logs.
- Emit data results directly for readings, dashboards, analysis, or other information that does not naturally create a file. Emit file outputs only after they exist in the job output directory. Never invent a downloadable snapshot merely to satisfy the runtime.
- Include metadata needed for a useful result view, such as dimensions, duration, format, or byte size.

## Review checklist for a candidate

Before opening the candidate preview, Codex runs `run.mjs` directly with a realistic request and temporary inputs inside staging. It parses the emitted JSON-line events, inspects real outputs, fixes any failure, and repeats the check until it passes. Live tools must complete a bounded check that obtains at least one real result. This check uses temporary data and commands rather than adding a test file to the tool package.

- The interface reaches its `ready` handshake after listeners are installed.
- Clicking the primary action immediately shows a local loading state.
- Selected files cross the bridge as `ArrayBuffer` descriptors.
- Inputs are validated again by the execution script; the UI is not trusted.
- Progress and logs describe the real execution stages.
- Success produces a visible preview or useful metadata and a save action.
- Preview failures and run failures are visible inside the tool interface.
- No generated browser code calls `fetch`, opens a WebSocket, or accesses Node.js or the filesystem.
- The manifest declares every external executable the script may invoke.
- The candidate presentation states what standalone check actually ran and what result was verified.
- The exact reviewed candidate revision is the revision that is tested and saved.
