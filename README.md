# ScriptForge

ScriptForge is a local app store where small utility apps do not exist until you ask Codex to forge them.

**OpenAI Build Week track:** Apps for your life

## Status

The local application shell, bundled image-resizer workflow, full MCP-guided Forge-to-library flow, encrypted tool configuration, portable archives, and opt-in dependency Doctor are working. Submission assets are being completed milestone by milestone.

## Key Features

- Local-only Hono server and React library launched from one CLI package
- GeckoUI application shell based on the checked-in Pencil design
- Hono-to-Spoosh inferred REST types with caching, in-flight deduplication, and automatic invalidation
- Preferred `127.0.0.1:4545` address with automatic port fallback
- Sandboxed plain-HTML tool interfaces connected to a controlled host bridge
- Bundled Sharp image resizer with progress, structured logs, before/after previews, and local result download
- Offline PDF Toolkit for mixed PDFs and images, with thumbnail reordering, rotation, merge, split, image page sizing/fit controls, and an explicit scan-flattening compression mode; PDF.js is bundled into the served interface and `pdf-lib` powers editable operations
- Zero-install App Icon Exporter that turns one local image into a ZIP containing iPhone, iPad, macOS, watchOS, Android legacy/adaptive, and Play Store assets plus honest Icon Composer-ready Liquid Glass source artwork
- Zero-install Favicon Creator that turns optional light and dark artwork into one ready-to-install ZIP for browsers, Apple touch and Safari pinned tabs, Android/PWA, and Windows tiles
- FFmpeg Media Toolkit for local video/audio conversion, compression, resize, trim, audio extraction and replacement, GIF creation, and capped frame extraction
- Code Screenshot Studio with language, theme, title, highlight, backdrop, padding, and chrome controls; Silicon is declared as an executable and uses the existing opt-in Doctor flow when missing
- Authorized-content Video Downloader for single videos and playlists from yt-dlp-supported sites, with quality/range controls, direct media results, and streamed ZIP packaging for multi-file playlists
- Codex CLI installation/authentication preflight with locally remembered model and effort choices
- Real embedded Codex TUI launched in a staging directory using the user's Codex permission configuration by default, with browser-refresh reconnection, durable restart recovery, and an explicit, locally remembered unsafe bypass opt-in
- Contextual plain-language question panels only when decisions remain unresolved; clear requests start building immediately
- Behavior-aware kickoff discovery that resolves core automation, timing, and output decisions instead of silently narrowing the request
- Trusted candidate and installed-tool previews with read-only Script and Details tabs
- Kickoff-authorized standalone runner checks before Codex can present a candidate
- Candidate tester with lifecycle events, bridge diagnostics, zero-file runs, and data or file results
- Exact presented-revision saving into the filesystem-backed library without a mandatory Preview run
- Save actions remain clickable when a candidate is presented, keep the Forge Codex session open, hide after that exact revision saves successfully, and use Save changes consistently when later revisions are ready in Forge or an installed-tool update
- Dynamic one-to-three-category manifests, with existing category reuse, legacy installed-tool compatibility, category search, and responsive category filters
- Concurrent scoped Codex terminals: one new-tool session plus one update session per installed tool, each with its own Stop control
- The Start Forge dialog defaults to a fresh session but can select, resume, or inline-confirm deletion of stopped/interrupted sessions; deletion removes the cached option immediately with automatic rollback on failure, and resumed work continues the exact Codex conversation in its preserved staging directory
- Missing-executable and version detection that keeps tools installed while blocking only their execution
- Opt-in Codex Doctor embedded beside the tool interface; it proposes OS-specific commands, waits for a separate Install click, streams installer-only terminal output, and verifies requirements afterward
- Dependency-free `.forge` export/import archives that preserve complete tool directories, validate and import immediately after selection, and never execute imported code; deleting an installed tool removes its Library card immediately with automatic rollback on failure
- Manifest-driven tool configuration with locally encrypted secrets that never enter generated HTML or `.forge` exports
- Confirmed deletion for Forge-saved and imported tools, with bundled starter tools protected in both the UI and API
- Whole-card library navigation with secondary user-tool menus and compact tooltip-labeled detail actions

## Prerequisites

- Node.js 20 or newer
- pnpm 10 for development

Codex CLI is not required for the starter library. Forge checks for it and shows manual installation and login guidance without changing the machine automatically. The Video Downloader separately requires `yt-dlp`, and the FFmpeg Media Toolkit requires `ffmpeg`; ScriptForge keeps either tool visible as Needs install and offers the opt-in Doctor flow when its executable is missing.

## Setup

```bash
pnpm install
pnpm dev
```

The development UI opens through Vite and proxies typed API calls to the local Hono server on port 4545.

## Build and Run

```bash
pnpm build
node dist/cli.js
```

The production CLI opens ScriptForge in the default browser. Pass `--no-open` when running it in an automated environment.

## Verification

```bash
pnpm check
pnpm lint
pnpm format
pnpm typecheck
pnpm test
pnpm build
pnpm pack --dry-run
```

## Architecture

The repository is one publishable npm package:

- `src/cli.ts` selects the local port, starts Hono, and opens the browser.
- `src/server` contains the local API and server utilities.
- `src/web` contains the React and GeckoUI application.
- Hono route types flow into Spoosh without a handwritten API schema.
- REST handles request/response operations; WebSocket handles job events and Forge terminal streams.
- Bundled and generated tools share a manifest, trusted `run.mjs`, and unrestricted same-origin `ui.html` runtime contract. Results may be structured data, direct in-place changes, or genuine file outputs according to the tool rather than a forced download.
- Installed tool directories round-trip through a versioned `.forge` JSON archive with Base64 file payloads, traversal-safe paths, size limits, and atomic import.
- Persistent tool configuration lives outside installed tool directories. Secret fields use AES-256-GCM with unique nonces and a generated local key; APIs return only whether a secret is configured.
- A session-scoped stdio MCP server gives Codex structured question, approval, and candidate-presentation tools; candidate presentation requires a summary of the real standalone check Codex completed.
- Forge prefers Node.js built-ins such as `fetch` before declaring system executables.

## Environment Variables

None are required for the current milestone. Never commit OpenAI credentials or Codex authentication data.

## Sample Data

The bundled image tools accept local PNG, JPEG, or WebP files, so no separate sample dataset is required. The image resizer, App Icon Exporter, and Favicon Creator are powered by `sharp` and require no system executable.

## Build Week Evidence

- **Track:** Apps for your life — ScriptForge lets people create focused local utilities for everyday files and workflows.
- **GPT-5.6 model:** The Forge preflight defaults to `gpt-5.6-sol` in `src/web/forge/preferences.ts`; `src/server/forge/service.ts` passes the selected model explicitly to every Codex CLI session.
- **GPT-5.6-powered features:** GPT-5.6 asks structured questions only when decisions remain unresolved, builds and exercises the standalone runner with realistic input, repairs failures, and presents checked staged candidates for code and optional UI review beside the live terminal. UI-only revisions reuse unchanged runner evidence and may be saved immediately. When requested, the separate Doctor session diagnoses missing executables and proposes current-machine installation steps without executing them itself.
- **Codex acceleration:** Codex helped define the trust model, inspect the Pencil design, configure the typed Hono/Spoosh boundary, implement the local shell and generic tool runtime, diagnose the iframe bridge and PTY integration, and write verification tests.
- **Key decisions:** Filesystem manifests replace a database; the server remains localhost-only; categories come from manifests with a hard three-category limit; and `#5468ff` is shared by the React/GeckoUI shell and generated-tool guidance. Forge sessions are server-owned and scoped, with small durable session records linking preserved staging directories to exact Codex conversation IDs. Stop preserves unsaved new-tool work but removes the temporary workspace after a tool is saved or during an installed-tool update; explicit deletion removes other resumable drafts. Exact-revision testing plus explicit Save remain the installation boundary. Tool interfaces are trusted same-origin apps without iframe sandbox or CSP restrictions, and runners have normal Node.js permissions, enabling internet-connected and in-place filesystem workflows. Missing dependencies keep tools visible but block execution until resolved through the opt-in Doctor flow. `.forge` remains a dependency-free, auditable archive, while persistent configuration stays outside exported tool packages and secret values remain encrypted locally.
- **Network dependency policy:** Tool interfaces may use remote APIs, CDNs, modules, fonts, and media. Important dependencies should be pinned when practical, network failures must be presented in the interface, and redistributed code or assets still require compatible licenses and attribution.
- **Doctor context routing:** ScriptForge injects the selected tool and missing-executable report into Doctor's developer instructions. The visible interactive user turn is only `Diagnose`, so internal requirement JSON does not clutter or masquerade as a user-authored terminal message.
- **Iframe trust model:** Candidate and installed previews are unsandboxed, same-origin, and network-enabled. They may use ScriptForge APIs and ordinary browser capabilities; their trusted runners may use local files, processes, and networks with the current user's permissions. Reviewing a tool before Save and importing only trusted `.forge` archives are therefore essential.
- **Tool identity:** Grid cards, list rows, and detail sidebars hash normalized primary-category text into stable OKLCH icon, top-edge, and hover accents, so each category keeps the same identity everywhere without a predefined color registry. Category chips remain neutral to avoid visual noise; attention-only status badges and the quiet indigo Built-in trust badge remain semantic. Ready tools need no redundant badge; exceptions stay visible.
- **Configuration UX:** Installed-tool configuration opens in the same trusted GeckoUI dialog used by Forge candidate previews. Saving refreshes the current tool in place; configuration never navigates to a separate settings screen.
- **App icon packaging:** The exporter uses the existing `sharp` dependency plus a small internal standards-compatible ZIP writer. It prepares Icon Composer artwork and instructions rather than fabricating Apple's editable layered `.icon` document from one flattened image.
- **Favicon packaging:** The creator keeps common root filenames for drop-in hosting, uses an adaptive SVG for optional light/dark artwork, and includes browser, Apple, Android/PWA, and Windows fallbacks. Its notes explicitly flag the generated pinned-tab raster silhouette for brand-vector review.
- **Trusted local tools:** Tool interfaces run same-origin without iframe sandbox or CSP restrictions and may use internet services, remote resources, ScriptForge APIs, and browser filesystem features. Their `run.mjs` processes have the current user's normal Node.js filesystem, process, and network permissions, enabling true in-place tools instead of copied-input/ZIP workarounds. ScriptForge therefore treats reviewed and imported tools as trusted code.
- **FFmpeg media operations:** One declared `ffmpeg` executable powers fixed, shell-free templates for video conversion/compression/resizing, media trimming, audio extraction/conversion/replacement/removal, palette-optimized GIFs, and capped frame ZIPs. Format, quality, dimensions, times, frame rates, and frame counts are allowlisted or bounded before execution.
- **Responsible media downloads:** The downloader requires an explicit authorization confirmation, passes URLs to `yt-dlp` without a shell, uses capped single-file formats that do not secretly require FFmpeg, and streams video/ZIP responses with byte-range support instead of buffering large results in application memory.
- **Verification:** Biome checks, TypeScript typecheck, automated host/API/MCP/UI tests, production builds, live local HTTP, Codex-readiness checks, npm package dry runs, and manual core-flow checks. Tests cover manifest validation, library filtering, concurrent and restart-resumable Forge/update sessions, exact Codex conversation selection, explicit draft discard, preference propagation, exact-revision Save/Update, dependency Doctor approvals, unrestricted candidate and installed iframe policy, archive round trips and path validation, encrypted configuration and redaction, tool-card behavior, PDF editing/compression, executable-backed media tools, and streamed result delivery.
- **Favicon verification:** A standalone runner check uses realistic 512 px light/dark inputs. Host integration opens the ZIP, verifies representative browser, Apple, PWA/Android, and Windows assets, validates the ICO header and adaptive dark-mode SVG, parses the web manifest, and decodes the Apple touch PNG.
- **FFmpeg verification:** A real standalone matrix exercises all ten media operations against generated two-second video/audio fixtures. Host integration uses a deterministic fake executable to verify declared FFmpeg argument templates, progress events, converted output metadata, capped frame extraction, and streamed ZIP contents.
- **Primary Codex Session ID:** `019f7198-5cb2-74b2-96a8-c8909989d1b2`.

## Limitations and Future Work

- `.forge` archives currently have no signatures or provenance metadata; import is local and intentionally does not execute code.
- Local secret encryption prevents accidental disclosure and archive leakage, but it does not protect against an attacker who can read both the current user's configuration files and generated local master key.
- macOS is the first supported platform; Windows and Linux should fail clearly where a capability is unavailable.
- Code Screenshot Studio requires the separate Silicon executable; ScriptForge keeps it visible as Needs install and starts Doctor only when requested.
- Video Downloader requires `yt-dlp`. Site support can change with upstream platforms, and users are responsible for downloading only content they own or have permission to copy and for following platform terms and local law.
- FFmpeg Media Toolkit results depend on the codecs enabled in the user's FFmpeg build. Frame extraction is capped at 300 PNGs per run to keep local jobs and ZIP sizes bounded.

## License and Acknowledgements

A project license will be selected before publishing the judging repository. Built with OpenAI Codex, GPT-5.6, Hono, React, GeckoUI, Spoosh, Sharp, `pdf-lib` (MIT), PDF.js (Apache-2.0), [FFmpeg](https://ffmpeg.org/), [Silicon](https://github.com/Aloxaf/silicon) (MIT), and [yt-dlp](https://github.com/yt-dlp/yt-dlp) (Unlicense).
