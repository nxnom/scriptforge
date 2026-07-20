# ScriptForge Architecture

This document contains the implementation detail intentionally omitted from the judge-facing README.

## Package and Application Shell

ScriptForge is one publishable npm package containing:

- `src/cli.ts`, which selects a localhost port, starts Hono, and opens the browser.
- `src/server`, which owns REST APIs, WebSockets, filesystem registries, jobs, Forge sessions, configuration, and tool execution.
- `src/web`, which contains the React, GeckoUI, React Router, and Tailwind application shell.
- Bundled tools and built web assets copied into `dist` during packaging.

The server binds only to `127.0.0.1`, prefers port `4545`, and selects another available port when necessary. Hono route types flow into Spoosh without a handwritten client schema. REST handles request/response operations; WebSockets handle terminal bytes, progress, structured logs, and job lifecycle events.

## Tools and Jobs

Bundled and generated tools contain a `tool.json` manifest, JavaScript `run.mjs` orchestration entrypoint, and self-contained `ui.html`. Manifests declare executable requirements and configuration fields but never installation commands or saved configuration values.

The host bridge connects tool interfaces to input selection, execution, lifecycle events, cancellation, logs, configuration, and safe result URLs. Jobs automatically emit `queued`, `running`, and one terminal lifecycle state. Tool-specific progress is included when measurable.

Installed tools live under `~/.scriptforge/tools`, Forge candidates under `~/.scriptforge/staging`, and temporary jobs under `~/.scriptforge/jobs`. Filesystem manifests replace a database.

## Forge and GPT-5.6

Forge starts Codex CLI through `node-pty` in a dedicated staging directory and explicitly passes the model and reasoning effort selected in the preflight dialog. The default model is `gpt-5.6-sol` with medium reasoning effort.

Terminal input, output, and resizing travel over WebSocket. Server-owned sessions reconnect after a browser refresh, and durable stopped or interrupted records can resume the exact Codex conversation and staging directory after a restart. Sessions are scoped: one new-tool session may coexist with one update session for each installed user tool.

A session-scoped stdio MCP server gives Codex structured capabilities for questions, approval requests, standalone-check evidence, and candidate presentation. Candidate discovery renders `ui.html` in Preview while Script and Details remain read-only. Saving validates the exact presented revision and installs it atomically. Preview is optional, and only the explicit Save action installs or updates a tool.

## Dependency Doctor

`tool.json` declares executable names and optional version constraints. ScriptForge checks the current `PATH`, keeps a tool visible when requirements are missing, and blocks only execution.

The optional Doctor launches a separate Codex session with the selected tool and missing-requirement context. It proposes operating-system-specific commands but does not execute them. The user must click Install before ScriptForge runs the exact command and arguments in a terminal stream, then rechecks the dependency.

## Configuration and Archives

Manifest-driven configuration supports text, secret, textarea, number, boolean, and select fields. Values live outside tool directories under `~/.scriptforge/config`; a generated key under `~/.scriptforge/secure` encrypts secrets with AES-256-GCM and unique nonces. Secret values are never returned to browser code after saving and known values are redacted from runner events.

User tools can be exported and imported as versioned `.forge` JSON archives with Base64 file payloads. Import rejects traversal, duplicate paths, malformed manifests, size-limit violations, and bundled-ID collisions without executing the archive. Configuration and encryption material are never exported.

## Trust Model

ScriptForge is a local tool workshop, not a remote multi-tenant sandbox. Candidate and installed interfaces are trusted, same-origin applications, and their runners have the current user's normal Node.js filesystem, process, and network permissions. This enables internet-connected workflows and true in-place file operations.

That power makes review important. Users should save Forge candidates only after reviewing them and import `.forge` archives only from sources they trust. Missing dependencies and installation remain separate explicit boundaries.

## Bundled Tool Implementation

- **Image Resizer:** Uses bundled Sharp and requires no system executable.
- **PDF Toolkit:** Uses `pdf-lib` and bundled PDF.js for mixed PDF/image editing and previews.
- **App Icon Exporter:** Uses Sharp plus an internal ZIP writer for Apple and Android assets.
- **Favicon Creator:** Produces adaptive browser, Apple, Android/PWA, and Windows assets.
- **FFmpeg Media Toolkit:** Uses allowlisted, shell-free FFmpeg argument templates.
- **Code Screenshot Studio:** Declares Silicon and uses the Dependency Doctor flow when missing.
- **Video Downloader:** Declares `yt-dlp`, requires authorization confirmation, and streams large results rather than buffering them in memory.
