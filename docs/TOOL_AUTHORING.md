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
3. A user action posts a `run` message containing validated input and serialized files.
4. The host acknowledges the request with `accepted`, starts the job through the REST API, and forwards job events over the bridge.
5. The interface renders `progress`, `log`, `result`, `failed`, and `complete` events.

Always verify `event.source`, the message `source`, and the message shape. Do not interpret arbitrary iframe or window messages as tool events.

## User actions and files

- Bind execution to an explicit button click with `type="button"`, or deliberately disable native form validation before relying on a form `submit` handler. Native constraint validation can prevent `submit` from firing without producing an application error.
- Do not send `File` objects directly across the sandbox boundary. Read each selected file with `arrayBuffer()` and send a descriptor containing `name`, `size`, `type`, `lastModified`, and `data`.
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
- Emit a `result` only after the declared output exists in the job output directory.
- Include metadata needed for a useful result view, such as dimensions, duration, format, or byte size.

## Review checklist for a candidate

- The interface reaches its `ready` handshake after listeners are installed.
- Clicking the primary action immediately shows a local loading state.
- Selected files cross the bridge as `ArrayBuffer` descriptors.
- Inputs are validated again by the execution script; the UI is not trusted.
- Progress and logs describe the real execution stages.
- Success produces a visible preview or useful metadata and a save action.
- Preview failures and run failures are visible inside the tool interface.
- No generated browser code calls `fetch`, opens a WebSocket, or accesses Node.js or the filesystem.
- The manifest declares every external executable the script may invoke.
- The exact reviewed candidate revision is the revision that is tested and saved.
