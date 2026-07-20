# Build Week Evidence

ScriptForge was built for the OpenAI Build Week **Apps for Your Life** track. Its premise is that people should be able to create focused local utilities for everyday files and workflows without searching for a new upload service or writing code themselves.

## GPT-5.6 and Codex

- The Forge preflight defaults to the exact `gpt-5.6-sol` identifier in `src/web/forge/preferences.ts`.
- `src/server/forge/service.ts` passes the selected model and reasoning effort explicitly to every Codex CLI session.
- GPT-5.6 asks structured questions when decisions remain unresolved, creates the manifest, runner, and interface, exercises the standalone runner with realistic input, repairs failures, and presents an exact candidate revision for review.
- UI-only revisions may reuse unchanged runner evidence. Preview is optional, while Save remains the user-controlled installation boundary.
- The separate Dependency Doctor uses Codex to diagnose missing executables and propose current-machine installation steps without executing them automatically.
- Primary Codex Session ID: `019f7198-5cb2-74b2-96a8-c8909989d1b2`.

## Where Codex Accelerated Development

Codex helped:

- Define the product scope, trust model, milestone plan, and explicit approval boundaries.
- Inspect and translate the Pencil design into the React and GeckoUI shell.
- Configure the typed Hono and Spoosh API boundary.
- Implement and debug the generic tool runner, host bridge, PTY terminal, MCP server, and resumable sessions.
- Build and exercise the bundled PDF, icon, favicon, FFmpeg, screenshot, download, and direct-SMTP tools.
- Diagnose exact-revision saving, iframe state, duplicated React keys, optimistic deletion, and package behavior.
- Create automated integration coverage and complete isolated npm-package smoke tests.

## Important Product and Technical Decisions

- Filesystem manifests replace a database, keeping the local product inspectable and portable.
- The Hono server binds only to localhost.
- One to three manifest categories support discovery without requiring a central taxonomy.
- `#5468ff` is shared by the React shell and generated-tool visual guidance.
- Forge sessions are server-owned, scoped, reconnectable, and linked to preserved staging directories and exact Codex conversation IDs.
- Stop preserves unsaved new-tool drafts but removes temporary workspaces after a saved Forge session or installed-tool update.
- Exact presented-revision validation plus explicit Save remains the installation boundary. Preview is useful but not mandatory.
- Tools stay installed when dependencies are missing; only execution is blocked until the user resolves the requirement or opts into Doctor.
- `.forge` remains a dependency-free, auditable archive while persistent configuration stays outside tool packages.
- Tool interfaces and runners are trusted local applications with normal network, filesystem, and process access. This enables in-place workflows but requires users to review or trust saved and imported code.

## Bundled-Tool Decisions

- App Icon Exporter produces Icon Composer-ready source artwork and instructions rather than pretending a flattened image is Apple's editable layered `.icon` format.
- Favicon Creator keeps conventional root filenames, generates an adaptive light/dark SVG, and includes browser, Apple, Android/PWA, and Windows fallbacks.
- FFmpeg Media Toolkit uses fixed, shell-free templates and validates format, quality, dimensions, time ranges, frame rates, and frame limits before execution.
- Video Downloader requires an authorization confirmation, avoids secretly requiring FFmpeg for its capped single-file formats, and streams direct or ZIP results.
- SMTP Campaign Sender uses the user's own SMTP server, keeps its password in encrypted runner-only configuration, and reports SMTP acceptance without claiming inbox delivery or adding remote engagement tracking.
- Remote code and assets remain subject to pinned-version, licensing, attribution, and failure-state expectations even though trusted tools may access the internet.

## Verification and Evaluation

The repository is checked with Biome, TypeScript, Vitest, and production builds. The automated suite currently contains 131 tests covering manifest validation, library filtering, host/API/MCP boundaries, concurrent and resumable Forge sessions, exact candidate selection and saving, Dependency Doctor approvals, trusted iframe behavior, `.forge` validation, encrypted configuration, redaction, card interactions, bundled PDF and media workflows, direct SMTP delivery, and streamed results.

The clean-package smoke test on July 20, 2026:

1. Built the publishable tarball.
2. Installed it with npm in an isolated temporary project with zero reported vulnerabilities.
3. Launched it through `npx --no-install scriptforge --no-open`.
4. Loaded the packaged React shell and eight bundled manifests.
5. Completed a real Image Resizer job over HTTP and WebSocket.
6. Observed `queued`, `running`, and `succeeded` events and decoded the requested 8 × 6 PNG output.
7. Repeated public-package startup verification with `npx --yes scriptforge@0.1.0 --no-open`, including automatic fallback from occupied port `4545`.

Additional focused checks include:

- Favicon ZIP inspection for browser, Apple, PWA/Android, and Windows assets; ICO header validation; adaptive SVG theme validation; manifest parsing; and PNG decoding.
- A real FFmpeg matrix across ten operations using generated two-second video/audio fixtures, plus deterministic host-integration checks for arguments, progress, output metadata, frame limits, and ZIP contents.
- Direct SMTP delivery to Mailpit with authentication, two CSV-personalized recipients, sender and reply-to parsing, unsubscribe footers, and server-visible message content, plus a deterministic local SMTP integration test for attachments and acceptance reports.
- Archive round trips, traversal rejection, missing-executable imports, deletion protection, configuration encryption, and secret redaction.
