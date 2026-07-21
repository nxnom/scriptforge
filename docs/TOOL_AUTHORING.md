# Tool Authoring Contract

This document records the interface contract that Codex must follow when it forges a ScriptForge tool. Its operational rules are mirrored directly into the Forge initialization instructions in `src/mcp`; update both whenever this contract changes.

## Package shape

Each tool contains:

- `tool.json` — metadata, entrypoint, accepted inputs, outputs, and required executable names.
- An execution script — reads one JSON request from standard input and writes newline-delimited JSON lifecycle events to standard output.
- `ui.html` — a self-contained plain HTML, CSS, and JavaScript interface.

Generated interfaces do not use React or GeckoUI unless the user explicitly requests a framework build. They run same-origin without an iframe sandbox attribute or restrictive Content Security Policy. Network requests, WebSockets, ScriptForge APIs, CDNs, remote ES modules, external stylesheets, remote fonts, frames, workers, media devices, and browser filesystem APIs are allowed. Browser JavaScript cannot import Node.js directly, but the trusted `run.mjs` process has normal Node.js filesystem, process, and network permissions. Pin important remote dependencies when practical and verify redistribution licenses for code or assets shipped inside the tool.

Before building a new tool, Forge presents three distinct visual directions inside one agent-designed interactive HTML canvas and waits for the user's choice. The agent controls the entire responsive layout, CSS, and JavaScript; ScriptForge only injects the validated selection bridge. Designed elements with `data-scriptforge-value` are selectable, receive `data-scriptforge-selected` and `aria-pressed`, and may also select through `window.scriptforgeSelect(value)`. ScriptForge reserves a 4px transparent border on unselected options so selection never changes dimensions, while each direction supplies a different high-contrast selected color suited to its own palette rather than applying ScriptForge blue to every option; no additional selection badges, icons, labels, or shadows are added. The first, recommended direction uses ScriptForge's compact dark system documented below. The other two directions use layouts, visual styles, and palettes suited to the tool's purpose. Small installed-tool updates do not repeat this choice unless the user requests or needs a material redesign.

## Persistent configuration

`tool.json` may declare a `configuration` array for values reused across runs. ScriptForge renders these fields in its trusted React shell; generated `ui.html` never renders or receives saved credentials.

- Use `text`, `textarea`, `number`, `boolean`, or `select` for ordinary persistent values.
- Use `secret` for API keys, access tokens, and passwords. Secret fields cannot declare defaults.
- Prefer provider access tokens over account passwords.
- Use configuration only for stable values such as credentials, account IDs, endpoints, and persistent preferences. Keep files and frequently changing choices in the normal per-run UI input.
- The runner receives resolved values in `request.config`. It must validate them and must never log them or include secrets in results.
- Configuration values are stored outside the tool directory and are never part of `.forge` exports.

## Default visual system

Unless the user explicitly requests a different style, generated tools use ScriptForge's compact dark visual system:

- Page background `#151515`; surfaces `#1d1d1d` or `#242424`; borders `#343434`; near-white primary text; muted text `#929292`; `#5468ff` primary actions and focus accents with white text; system UI fonts.
- The same interface appears in both a 420–620px Forge tester and a much wider installed Tool page. Build one fluid utility workspace that uses the full iframe width at both sizes. Do not place the whole interface inside a centered `max-width` wrapper or center the entire app in a large empty canvas.
- Use border-box sizing. Give `html`, `body`, and the root workspace `width: 100%`, `min-width: 0`, and `min-height: 100%`; remove the default body margin. The root may use `min-height: 100vh`, but controls and content panels must not use fixed viewport heights.
- Use a short 18–22px title and no more than one brief description line. Do not add eyebrow labels, hero copy, oversized headings, decorative introductions, or repeated explanations.
- Use 12–16px outer padding, 8–12px gaps, compact controls, and restrained card padding. Keep file selection, essential controls, current status, and the primary action in the first visible panel viewport whenever practical.
- Choose a tool-specific layout instead of defaulting to one centered form card. When inputs and results are both meaningful, stack them in the narrow tester and use a balanced side-by-side or dashboard composition on wide canvases. For a compact single control group, keep the controls readable while status, history, results, or details use the remaining width. Empty messages belong inside their future result region rather than leaving the page blank.
- At widths around 800px and above, use a `min-height: 100vh` flex-column page shell and a `flex: 1` stretching main grid so the primary input and result cards fill the available row height instead of ending above a large blank area. Long results may scroll inside their card. At the narrow breakpoint, return the main layout and cards to `height: auto` so the stacked tester remains content-height.
- In the narrow stacked layout, keep related inputs, options, actions, progress, and status top-aligned with compact gaps. Do not put `justify-content: space-between`, `space-around`, or `space-evenly` on a full-height vertical form, input card, or control column. Allow only a genuine result region to consume spare height.
- Remain usable at 360px without horizontal scrolling. Use fluid grids with `minmax(0, 1fr)`, wrapping controls, and a deliberate breakpoint around 700–800px. Avoid fixed page heights, large minimum heights, and large empty areas. Result collections may grow or scroll as needed.
- Once files are selected, replace the empty drop zone in the same footprint with compact thumbnails or file rows and Change/Add and Remove actions. Do not retain a large empty “Choose files” area above a duplicate selected-file preview.
- If a drop zone claims drag-and-drop support, implement `dragenter`, `dragover`, `dragleave`, and `drop`. Prevent browser navigation, stop propagation, show an active state, read `event.dataTransfer.files`, apply the same type and operation validation as the picker, and send accepted files through the same selection code. Drop-related copy or styling without functional file acceptance is not allowed.
- Do not impose arbitrary per-file, total-upload, page-count, media-duration, or image-pixel limits. ScriptForge runs locally, so the user's machine determines practical capacity. Continue to validate file types and operation-specific values, and explain genuine limits imposed by an executable or file format.
- Give the tool an intentional hierarchy of controls, current state, primary result, and secondary logs/details. Reveal results in the existing result region or a compact section using the grid, table, media preview, reading, or list appropriate to the data. Truncate long filenames and keep result actions easy to reach.
- Show loading, progress, success, and failure without unnecessary layout shifts. Keep verbose logs collapsed unless needed.
- Before presenting the candidate, inspect the CSS at representative 480px and 1200px iframe widths. Nothing may clip or scroll horizontally at 480px and stacked cards should remain content-height. At 1200px, primary cards must stretch through the available height instead of ending above a large blank lower canvas, and the workspace must not leave a narrow centered island.

Generated interfaces use ordinary CSS because their runtime HTML cannot depend on the React application's Tailwind build.

## Kickoff discovery

Before creating candidate files, Codex identifies every unresolved user-facing decision that would materially change the tool's behavior, automation, timing, inputs, outputs, destructive actions, data source, format, quality, or privacy. It presents a short plain-language question panel only when such decisions remain; a clear request begins immediately without a separate kickoff approval.

Codex runs a realistic standalone runner check for the first candidate and repeats it when `tool.json` or `run.mjs` changes. A later `ui.html`-only revision reuses that runner evidence and proceeds directly to interface review. Preview is optional and never blocks Save.

- Ask all behavior-changing questions together and require answers where needed. Do not silently choose an easier or narrower behavior.
- Treat words such as “live,” “automatically,” “watch,” “monitor,” “sync,” “continuous,” “recurring,” and “update” as core requirements.
- A live or monitoring tool must perform repeated automatic updates. If cadence or controls are unspecified, ask for the refresh interval and whether updates start automatically or use Start/Pause controls. A manual Refresh button alone is not a live-update implementation.
- Suggest a small set of relevant optional features for the specific tool. Do not overwhelm a nontechnical user with unrelated possibilities.
- Minor reversible defaults can be stated clearly in the proposal, but behavior-changing assumptions require a question or explicit approval.
- Wait for the user's answers and approval before touching candidate files.

Available question inputs:

- `single_choice` renders radio buttons and is only for mutually exclusive answers where exactly one can be true.
- `multi_choice` renders checkboxes and is for choosing a supported set such as currencies, formats, fields, or features.
- `text` renders a short input or textarea for open-ended answers. Use a separate optional “Other…” text question when a predefined list may be incomplete; do not repurpose the general feedback note.
- Every input supports `defaultValue`. Choice defaults must match option values and should preselect the recommended answer or answers.

For example, a price tool that can switch currencies asks “Which currencies should be available?” with checkboxes, recommended defaults, and an optional “Other currencies” text field. It does not force one radio-button currency unless the product truly supports only one.

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
- When using the standard job bridge, do not send `File` objects directly. Read each selected file with `arrayBuffer()` and send a descriptor containing `name`, `size`, `type`, `lastModified`, and `data`. Send `files: []` when the tool does not use copied file input. In-place filesystem tools may instead send paths or operation parameters to their trusted runner.
- A tool that operates on existing folders must not provide only a pasted-path input. It provides both manual absolute-path entry and an **Add folder** or **Choose folder** action that opens a custom folder-browser dialog.
- Folder browsing uses a read-only runner action over the normal bridge, such as `{ action: "browseFolders", path, showHidden }` with `files: []`. The runner defaults to the user's home directory, resolves roots and parents cross-platform, validates directories, and returns the current path, parent path, and child folder names and paths as structured data.
- The dialog includes Close, Up, an editable current-path field with Go, a scrollable folder list, an optional hidden-folder toggle, visible errors, and **Add this folder** or **Choose this folder**. Multiple-folder tools append confirmed paths as removable rows.
- Do not use `<input type="file" webkitdirectory>` as the only folder picker. It exposes selected files and relative names rather than the absolute folder path required for an in-place filesystem operation.
- Browsing is non-mutating. Deletion, overwrite, or cleanup happens only through the separate primary action after an appropriate preview or confirmation.
- Disable the action while a run is active and restore it after either `complete` or `failed`.
- Surface bridge and runtime failures inside the interface, not only in DevTools.
- The iframe is unsandboxed and same-origin. It may use normal browser capabilities and make network or same-origin API requests. Some browser features still require the browser's own user gesture or operating-system permission.

## Output previews

- The host returns same-origin `previewUrl` and `downloadUrl` values for approved job outputs.
- Assign `previewUrl` to an appropriate `<img>`, `<video>`, or `<audio>` element. Assign `downloadUrl` to an explicit save link.
- Keep output URLs relative. ScriptForge can run directly on its local server or through a development proxy, so a tool must not hard-code a host or port.
- There is no tool-specific CSP. Same-origin and remote images, media, scripts, modules, fonts, frames, APIs, and `blob:`/`data:` previews are available subject to ordinary browser and remote-server CORS behavior.
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
- The implemented behavior matches the user's request and every resolved clarification; “live” behavior is actually automatic and recurring.
- Clicking the primary action immediately shows a local loading state.
- The default UI matches ScriptForge's compact dark theme unless the user requested another style.
- The page shell fills the iframe and adapts cleanly at representative 480px and 1200px widths without a centered max-width island; at 1200px its primary cards stretch through the available height rather than leaving a large blank lower canvas.
- Essential controls and the primary action fit in the initial tester viewport whenever practical.
- Selecting files replaces the empty picker instead of creating a second, duplicate file-preview area.
- Selected files cross the bridge as `ArrayBuffer` descriptors.
- Every advertised drop zone is checked with a real or dispatched dropped `File`; its selected-file preview and primary action must update.
- Folder-based tools offer manual absolute paths and a working custom folder browser rather than only a pasted-path field.
- Inputs are validated again by the execution script; the UI is not trusted.
- Progress and logs describe the real execution stages.
- Success produces a visible preview or useful metadata and a save action.
- Preview failures and run failures are visible inside the tool interface.
- Generated browser code may call `fetch`, open WebSockets, use ScriptForge APIs, load remote resources, or use browser filesystem APIs. Node.js work remains in `run.mjs`.
- Remote dependencies are allowed. Pin important versions when practical, handle network failures visibly, and record licenses for redistributed code or assets.
- Persistent values are declared in the manifest, secrets are not collected by `ui.html`, and the runner does not log or return them.
- The manifest declares external executable dependencies needed for readiness checks and Doctor guidance; the runner is trusted and not sandboxed to that list.
- The candidate presentation states what standalone check actually ran and what result was verified.
- The exact presented candidate revision is the revision that is saved; Preview testing is optional.
