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
6. The user explicitly approves tests or other candidate execution.
7. The user reviews the working result and clicks Save to add the exact reviewed candidate to the library.

## Tool Shape

A local tool initially lives in its own directory and contains:

```text
<tool-id>/
├── tool.json
├── ui.html
└── execution files
```

`tool.json` describes the tool, entrypoint, inputs and outputs, and `requiredExecutables`. It does not prescribe how dependencies are installed.

The generated `ui.html` is self-contained plain HTML, CSS, and JavaScript. Codex chooses controls and result presentation appropriate to the task, such as drag-and-drop input, buttons, progress, before/after previews, playable media, downloadable output, or metadata.

## Dependency Doctor

Before a tool runs, ScriptForge checks every declared executable. When one is missing, a Codex-powered Doctor:

1. Inspects the operating system and available package managers.
2. Determines an appropriate installation command.
3. Explains what will change and displays the exact command.
4. Executes only after explicit user approval.
5. Verifies that the executable is available afterward.

The MVP is macOS-first. Unsupported platforms must receive a useful explanation rather than failing silently or running a guessed command.

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

The main application uses GeckoUI. Generated tool interfaces intentionally do not: they are lightweight HTML/CSS/JS authored for the tool.

## Safety Guarantees

- Localhost-only server exposure by default.
- Staged generation before installation.
- No candidate execution, dependency installation, or library save without approval.
- No direct shell, Node.js, or unrestricted filesystem capability exposed to generated browser JavaScript.
- No Codex bypass-approval flag.
- Required executables are visible in the manifest and review UI.
- Saving verifies that the candidate has not changed since the reviewed/tested revision.

## Starter Tool

The first end-to-end tool is an image resizer using the bundled `sharp` package. It supports file selection or drag-and-drop, resize controls, progress, and a before/after result. It requires no external executable.

## Deferred Scope

- Importing tools from other people
- AI security summaries during import
- Exporting a tool as one shareable file
- Final cross-platform sharing format
- A broad starter-tool catalog beyond what the demo needs

## Open Decisions

Resolve these before their affected milestone begins:

- Final generated-script entrypoint contract and progress/result protocol
- Exact sandbox and host bridge exposed to generated `ui.html`
- Permanent local storage paths and metadata format
- Whether forge sessions expose only the Codex TUI or add structured GeckoUI review panels alongside it
- Exact GPT-5.6 Codex model identifier supported by the installed CLI
