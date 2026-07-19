# ScriptForge Product Specification

## Summary

ScriptForge is a local app store for utilities that can be created on demand. A user runs `npx scriptforge`, which starts a local server and opens a browser-based library. Each tool combines an execution script with a small, purpose-built HTML interface.

The project is an **Apps for your life** submission for OpenAI Build Week.

## Core Experience

1. The user opens ScriptForge and sees installed starter and forged tools.
2. The user opens a tool, supplies local input, watches progress, and reviews its output.
3. The user opens Forge to start an interactive Codex CLI session inside the application.
4. The user and Codex discuss the desired utility. Codex creates its script, `tool.json`, and custom HTML interface in staging.
5. ScriptForge shows the generated code and required executables.

The Library follows the `UVKcL` Pencil composition: a compact top bar with centered search, a desktop filter rail, a prominent blue `.forge` import panel, and a dense responsive tool grid. Selecting or dropping one archive starts validation and import immediately; the panel states that nothing runs during import, so there is no redundant confirmation click, and cancelling the native picker remains a silent no-op. On smaller screens, status and category filters share one GeckoUI menu with labeled groups and explicit checkmarks. Grid cards, list rows, and tool detail identity cards share a restrained primary-category accent on the icon and top edge; category chips remain neutral, only states requiring attention receive a status badge, and the Built-in trust badge uses a quiet indigo tint. The mobile tool detail keeps its identity summary compact, prioritizes the runnable preview, and groups configuration and installed-tool management in one actions menu. Categories are derived from actual bundled and installed manifests rather than a predefined taxonomy. A tool has one to three categories, normally one or two. Forge chooses the primary category from the tool's user outcome, then reuses an existing name only when it is equally accurate; broad categories such as Files are not fallbacks for every tool that happens to create a file. Legacy installed manifests with a single `category` are normalized in memory.
6. The user explicitly approves tests or other candidate execution.
7. The user reviews the working result and clicks Save to add the exact reviewed candidate to the library.

## Tool Shape

A local tool initially lives in its own directory and contains:

```text
<tool-id>/
├── tool.json
├── ui.html
└── run.mjs
```

`tool.json` describes the portable tool itself: its version, script and interface entrypoints, categories, configuration schema, and `requiredExecutables`. It does not prescribe how dependencies are installed. The detail page derives Runtime from the validated script entrypoint, derives Source from the directory in which ScriptForge discovered the package (bundled or saved/imported), and reports local execution from the host runtime. Source must not be stored in the archive because the same tool can change origin after export and import.

Generated tools follow the bridge, lifecycle, preview, and logging rules in [TOOL_AUTHORING.md](./TOOL_AUTHORING.md). The Forge system prompt should draw from that contract so new tools use the same tested host integration.

The generated `ui.html` is self-contained plain HTML, CSS, and JavaScript. Codex chooses controls, actions, and result presentation appropriate to the specific task, such as live readings, tables, charts, drag-and-drop input, progress, before/after previews, playable media, genuine downloadable output, or metadata. Unless the user requests another style, generated interfaces use ScriptForge's compact dark visual system with `#5468ff` primary actions and focus accents, avoid marketing-style introductions, keep the primary flow in the initial panel viewport when practical, and replace empty file drop zones with compact selected-file content instead of duplicating both states. A single fluid layout must fill the iframe and adapt from the 420–620px Forge tester to the wide installed Tool page; the whole app is never placed in an arbitrary centered max-width wrapper. Inputs and meaningful results stack narrowly and use balanced side-by-side or dashboard regions when wide. Tools are not required to accept files or create a downloadable snapshot. The interface runs in a sandboxed iframe and communicates only through a controlled ScriptForge host bridge. One shared iframe policy grants ordinary browser UI capabilities—scripts, downloads, forms, modal dialogs, clipboard read/write, workers, and same-origin result frames—consistently in Forge and installed previews. It still blocks CDNs, arbitrary runtime network access, Node.js, shell, and unrestricted filesystem access. Simple charts should use native SVG or Canvas; a genuinely useful small third-party browser library may be pinned, source- and license-checked during Forge, and inlined into `ui.html` under the 3 MB candidate review limit so it remains offline and portable.

Before building, Codex's kickoff panel asks every unresolved question that materially changes user-facing behavior and suggests a focused set of relevant options. Request terms such as “live,” “automatic,” “monitor,” and “sync” are treated as requirements rather than labels. For live tools, the kickoff resolves cadence and automatic versus Start/Pause behavior; a manual refresh-only result is rejected as incomplete.

For the MVP, each tool uses a JavaScript `run.mjs` orchestration entrypoint. Node.js is already guaranteed by `npx scriptforge`, while the entrypoint may invoke any external executables declared by the tool.

Tool packages do not contain generated test files. Candidate behavior is exercised through a user-approved run in the sandboxed tester iframe; ScriptForge itself tests the shared host bridge, runner, validation, and safety boundaries.

The runtime supplies controlled capabilities for declared executable calls, lifecycle, progress, structured logs, safe output registration, and cancellation. Every tool receives basic queued/running/succeeded/failed/cancelled state even when detailed percentage progress is unavailable.

Generated scripts must log startup, major stages, external command activity, completion, and failures. Logs are structured for polished presentation in the generated interface, with raw CLI output available as collapsible detail. ScriptForge redacts sensitive values before events reach browser code.

## Dependency Doctor

Before a tool runs, ScriptForge checks every declared executable. When one is missing, a Codex-powered Doctor:

1. Inspects the operating system and available package managers.
2. Determines an appropriate installation command.
3. Explains what will change and displays the exact command.
4. Executes only after explicit user approval.
5. Streams the approved command's real terminal output.
6. Verifies that the executable is available afterward.

The MVP is macOS-first. Unsupported platforms must receive a useful explanation rather than failing silently or running a guessed command.

A missing executable does not reject an otherwise valid saved or imported tool. The library keeps the tool, labels it Needs install, and blocks only execution. ScriptForge first shows the missing names and version constraints with a Retry action so the user may install them independently. Codex Doctor starts only after the user explicitly chooses Launch Codex Doctor. It temporarily owns the tool-detail workspace so proposal and installer output remain focused; after successful verification it closes and reveals the ready tool preview.

Doctor cannot install packages directly. It submits an executable-plus-arguments proposal through its dedicated MCP tool. ScriptForge replaces the Codex terminal with that immutable proposal and its Request changes and Install controls, so conversation output and installation approval never compete on screen. Install is the separate approval boundary: ScriptForge detaches and stops Codex, purges its terminal replay history, and starts only the approved commands through an installer `node-pty`. The terminal then contains installer output only. ScriptForge rechecks every declared requirement when the process ends and silently closes a successful Doctor session, leaving the tool interface ready to test.

The tool identifier, missing-executable status report, and proposal workflow are injected into Codex's developer instructions rather than exposed as a synthetic user request. The interactive TUI receives only the one-word user trigger `Diagnose`, keeping internal JSON out of the visible conversation while preserving the complete assignment at the higher-priority instruction layer.

## Technical Architecture

```text
React + GeckoUI application shell
  ├── Spoosh typed REST calls ────────────────> Hono server
  ├── job event WebSocket ────────────────────> tool runner
  └── terminal WebSocket <────> node-pty <────> Codex CLI
                                                   └── stdio MCP <────> ScriptForge MCP server

Generated HTML/JS tool UI
  └── controlled host bridge ─────────────────> tool runner ─────> declared CLI executables
```

The main application uses GeckoUI with Tailwind utility classes directly in React components. Generated tool interfaces intentionally use neither React nor GeckoUI: they are lightweight, self-contained HTML/CSS/JS authored for the tool.

Each Forge workspace displays its own real interactive Codex TUI through xterm.js. ScriptForge permits one new-tool session plus one update session per installed tool, so independent tools can be edited concurrently without replacing another PTY. Each Stop action ends only its owning session. The GeckoUI side panel is contextual rather than permanently visible: it opens for human questions and approvals or to display a generated tester interface. The tester view renders `ui.html` and offers a read-only viewer for the execution script, not the HTML source. Script changes invalidate prior test results. Save becomes available only after the exact current revision succeeds in the tester, installs or atomically updates the copy under `~/.scriptforge/tools`, and keeps the owning Codex PTY alive until Stop is clicked.

Installed tool detail pages use the same compact Preview, Script, and Details tabs. Preview renders the sandboxed `ui.html`; Script shows read-only `run.mjs`; Details shows read-only `tool.json`. Source views include line numbers and lightweight syntax highlighting. The HTML source is not exposed. Script and manifest inspection remain available even when missing dependencies block Preview and execution.

## Local Data

```text
~/.scriptforge/
├── tools/       # installed tools
├── staging/     # Forge candidates
├── jobs/        # temporary inputs and outputs
├── config/      # per-tool persistent configuration; secret entries are encrypted
├── secure/      # generated local encryption key
└── settings.json
```

There is no database. Tool manifests and directories are the source of truth.

Tools may declare persistent configuration fields in `tool.json`. ScriptForge renders them in a trusted GeckoUI form rather than inside generated HTML. Ordinary values and AES-256-GCM encrypted secret entries share a per-tool configuration file outside the tool directory. A generated 256-bit local key is stored separately, and authenticated encryption binds every secret to its tool and field identifier. Saved secrets are never returned to the browser, included in an archive, or exposed to the generated iframe. The server decrypts them only while constructing a runner request and redacts known values from emitted events and errors.

Forge candidates persist across application restarts. On startup, ScriptForge removes temporary job inputs and outputs older than 24 hours.

The server binds only to `127.0.0.1`, prefers port `4545`, and selects another available port when necessary.

## Forge Preflight

Before opening the Codex terminal, ScriptForge presents GeckoUI selects for the model and reasoning effort. The default is GPT-5.6 Sol with medium effort. Model options are GPT-5.6 Sol, Terra, Luna, GPT-5.5, GPT-5.4, GPT-5.4 Mini, GPT-5.3 Codex, and GPT-5.2; availability depends on the installed CLI and account. Effort options are minimal, low, medium, high, and xhigh.

The browser remembers the last selection in `localStorage`. The selected values are recorded with the candidate and supplied explicitly to Codex.

ScriptForge checks whether Codex CLI is installed and authenticated. A failed preflight does not block the library or starter tools. Forge instead shows installation or `codex login` guidance and a Retry action; it never installs or authenticates Codex automatically.

## Package Shape

The MVP is one publishable `scriptforge` npm package containing the CLI, Hono server, React/Vite application, and compiled web assets. Development uses pnpm, while the published executable remains compatible with `npx scriptforge`.

## Visual Source

`ui.pen` is the visual source of truth for the main React application. It defines the Library workspace, reusable dependency badge and tool-card patterns, dark design tokens, Geist headings, and Inter body typography. Implementation must inspect the design through Pencil MCP and use GeckoUI where applicable.

## Safety Guarantees

- Localhost-only server exposure by default.
- Staged generation before installation.
- No candidate execution or library save without approval. Dependency installation also requires separate approval in the default mode.
- No direct shell, Node.js, or unrestricted filesystem capability exposed to generated browser JavaScript.
- Preserve Codex approval and sandbox behavior by default. Forge may pass `--dangerously-bypass-approvals-and-sandbox` only when the user explicitly enables the warned, off-by-default preflight option; remember that preference in browser local storage. That opt-in pre-authorizes Codex to install dependencies genuinely required to build and test the current candidate, try reasonable alternatives, and continue without another prompt. It does not authorize unrelated machine changes, Codex installation/authentication, or saving the tool.
- Required executables are visible in the manifest and review UI.
- Saving verifies that the candidate has not changed since the reviewed/tested revision.
- Required configuration blocks execution until the trusted host form is complete; the original run continues after a successful save.
- Tool deletion also removes its local configuration. Export reads only the tool directory and cannot include configuration or encryption-key files.

## Starter Tool

The first end-to-end tool is an image resizer using the bundled `sharp` package. It supports file selection or drag-and-drop, resize controls, progress, and a before/after result. It requires no external executable.

The bundled App Icon Exporter reuses `sharp` to build one local ZIP containing iPhone, iPad, macOS, watchOS, Android legacy/adaptive, and store artwork. It also prepares 1024 px and 1088 px source images for Apple Icon Composer with explicit instructions. It does not claim that one flattened bitmap can become Apple's editable layered `.icon` document.

The bundled Video Downloader declares `yt-dlp` and uses the normal Needs install and opt-in Doctor path when it is absent. It supports one authorized video or a playlist range, selects a self-contained media stream so FFmpeg is not an undeclared dependency, packages multiple results into one local ZIP, and streams large outputs with byte-range support. The trusted runner validates the user's authorization acknowledgement even if browser UI validation is bypassed.

## Portable Tool Archives

An installed tool exports as one `.forge` file containing its complete directory. Import validates the archive envelope, relative paths, manifest, required entry files, size limits, and identifier collisions before atomically reconstructing the tool under `~/.scriptforge/tools`. Import never loads or executes the runner.

After import, the normal requirement check marks the tool Ready or Needs install. A missing executable is not an import error: the interface remains reviewable, execution stays blocked, and the user may install it independently or explicitly launch Doctor.

Forge-saved and imported tools expose Export and Delete actions. Delete requires confirmation and atomically removes the local tool directory. Bundled starter tools expose neither the Delete action nor a deletable server resource.

In the library, the complete available-tool card opens its detail page; there is no separate Open button. User-tool cards keep management secondary through a compact overflow menu. On the detail page, Export and Delete are direct icon buttons with accessible labels and tooltips.

## Deferred Scope

- Archive signing, provenance, and compatibility metadata
- Remote publishing or a shared marketplace
- A broad starter-tool catalog beyond what the demo needs

## Open Decisions

Resolve these before their affected milestone begins:

- Exact GPT-5.6 Codex model identifier supported by the installed CLI
- Enforcement details for blocking undeclared direct process execution from a Forge session
