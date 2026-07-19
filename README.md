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
- Offline PDF Toolkit with thumbnail page reordering, rotation, merge, split, and an explicit scan-flattening compression mode; PDF.js is bundled into the served interface and `pdf-lib` powers editable operations
- Code Screenshot Studio with language, theme, title, highlight, backdrop, padding, and chrome controls; Silicon is declared as an executable and uses the existing opt-in Doctor flow when missing
- Codex CLI installation/authentication preflight with locally remembered model and effort choices
- Real embedded Codex TUI launched in a staging directory using the user's Codex permission configuration by default, with terminal reconnection after browser refresh and an explicit, locally remembered unsafe bypass opt-in
- Mandatory plain-language kickoff approval with required questions and separate Markdown, Mermaid, and HTML blocks
- Behavior-aware kickoff discovery that resolves core automation, timing, and output decisions instead of silently narrowing the request
- Sandboxed candidate and installed-tool previews with read-only Script and Details tabs
- Kickoff-authorized standalone runner checks before Codex can present a candidate
- Candidate tester with lifecycle events, bridge diagnostics, zero-file runs, and data or file results
- Exact tested-revision saving into the filesystem-backed library
- Successful Save closes the Forge Codex session and opens the installed tool immediately
- Dynamic one-to-three-category manifests, with existing category reuse, legacy installed-tool compatibility, category search, and responsive category filters
- Explicit Stop control while the single Codex terminal is active, followed by Start session when it ends
- Missing-executable and version detection that keeps tools installed while blocking only their execution
- Opt-in Codex Doctor embedded beside the tool interface; it proposes OS-specific commands, waits for a separate Install click, streams installer-only terminal output, and verifies requirements afterward
- Dependency-free `.forge` export/import archives that preserve complete tool directories, validate and import immediately after selection, and never execute imported code
- Manifest-driven tool configuration with locally encrypted secrets that never enter generated HTML or `.forge` exports
- Confirmed deletion for Forge-saved and imported tools, with bundled starter tools protected in both the UI and API
- Whole-card library navigation with secondary user-tool menus and compact tooltip-labeled detail actions

## Prerequisites

- Node.js 20 or newer
- pnpm 10 for development

Codex CLI is not required for the starter library. Forge checks for it and shows manual installation and login guidance without changing the machine automatically.

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
- Bundled and generated tools share a manifest, `run.mjs`, and sandboxed `ui.html` runtime contract. Results may be structured data or genuine file outputs according to the tool rather than a forced download.
- Installed tool directories round-trip through a versioned `.forge` JSON archive with Base64 file payloads, traversal-safe paths, size limits, and atomic import.
- Persistent tool configuration lives outside installed tool directories. Secret fields use AES-256-GCM with unique nonces and a generated local key; APIs return only whether a secret is configured.
- A session-scoped stdio MCP server gives Codex structured question, approval, and candidate-presentation tools; candidate presentation requires a summary of the real standalone check Codex completed.
- Forge prefers Node.js built-ins such as `fetch` before declaring system executables.

## Environment Variables

None are required for the current milestone. Never commit OpenAI credentials or Codex authentication data.

## Sample Data

The bundled image resizer accepts a local PNG, JPEG, or WebP file, so no separate sample dataset is required. It is powered by `sharp` and requires no system executable.

## Build Week Evidence

- **Track:** Apps for your life — ScriptForge lets people create focused local utilities for everyday files and workflows.
- **GPT-5.6 model:** The Forge preflight defaults to `gpt-5.6-sol` in `src/web/forge/preferences.ts`; `src/server/forge/service.ts` passes the selected model explicitly to every Codex CLI session.
- **GPT-5.6-powered features:** GPT-5.6 proposes each utility in plain language, asks structured questions when needed, waits for approval, builds and exercises the standalone runner with realistic input, repairs failures, and presents tested staged candidates for code and UI review beside the live terminal. When requested, the separate Doctor session diagnoses missing executables and proposes current-machine installation steps without executing them itself.
- **Codex acceleration:** Codex helped define the safety model, inspect the Pencil design, configure the typed Hono/Spoosh boundary, implement the local shell and generic tool runtime, diagnose the sandbox bridge and PTY integration, and write verification tests.
- **Key decisions:** Filesystem manifests instead of a database; localhost-only server; a compact Pencil-derived rail-and-grid library keeps search and a prominent safe-import panel stable while only tool results scroll; categories are created on demand from manifests rather than a predefined taxonomy, chosen from the tool's user outcome before existing-name reuse, with a hard three-category limit; `#5468ff` is shared by the React/GeckoUI theme and generated-tool guidance; one server-owned in-memory Forge PTY; the main Forge action opens configuration when idle and reconnects directly when a session is active; Forge preserves the user's Codex sandbox and approval settings by default, while an explicit warned preflight checkbox can opt into bypass mode and remembers that choice only in browser local storage. In bypass mode, dependencies genuinely required to build and test the current candidate are pre-authorized so Codex attempts installation and reasonable alternatives instead of asking again; saving remains a separate user action. Blocking kickoff panels temporarily replace the terminal and close immediately on submission; kickoff approval authorizes standalone checks in staging; candidate testers run the exact presented revision; runner results match the tool as structured data and/or real file outputs instead of forced snapshots; generated interfaces use a network-blocked sandboxed iframe and a fluid compact-dark workspace that adapts from the Forge panel to the wide installed page instead of centering one narrow card; Save copies only the exact successfully tested revision and remains separately user-controlled. Missing dependencies never reject a valid saved or imported tool: only execution is blocked. Doctor is user-launched inside the tool page, cannot mutate the machine directly, and its exact proposal requires a separate Install click. Approval detaches Codex before ScriptForge runs the installer PTY, keeping installation output independent from the agent conversation. `.forge` stays dependency-free and auditable as a versioned JSON archive instead of introducing a ZIP dependency. Persistent configuration stays outside tool packages; secret values use portable local authenticated encryption and are injected only into runner requests. The bundled PDF Toolkit keeps normal editing lossless and searchable; its optional size-reduction mode is intentionally limited to scanned documents and clearly warns that flattening removes text, links, forms, and accessibility structure.
- **Offline dependency policy:** Forge and Doctor verify exact package metadata or pinned upstream download URLs before presenting or running installation steps. Generated iframe interfaces never depend on CDNs. Simple visualizations use native SVG or Canvas; a small third-party browser library is permitted only when its pinned source and redistribution license are checked and its browser distribution plus license notice are inlined into `ui.html` under the review-size limit. This makes the tested interface the same portable content preserved by `.forge` export.
- **Doctor context routing:** ScriptForge injects the selected tool and missing-executable report into Doctor's developer instructions. The visible interactive user turn is only `Diagnose`, so internal requirement JSON does not clutter or masquerade as a user-authored terminal message.
- **Iframe capability boundary:** Candidate and installed previews now share one capability policy: ordinary browser scripts, downloads, forms, modal dialogs, clipboard read/write, workers, and same-origin result frames are available. Generated interfaces remain offline and cannot call arbitrary network services or receive Node.js, shell, or unrestricted filesystem access. Generated tools retain a selectable-text fallback for browsers that still refuse clipboard access. The PDF Toolkit renders result pages with its bundled PDF.js canvas renderer because some browsers block their native PDF viewer inside any sandboxed nested frame.
- **Tool identity:** Grid cards, list rows, and detail sidebars hash normalized primary-category text into stable OKLCH icon, top-edge, and hover accents, so each category keeps the same identity everywhere without a predefined color registry. Category chips remain neutral to avoid visual noise; attention-only status badges and the quiet indigo Built-in trust badge remain semantic. Ready tools need no redundant badge; exceptions stay visible.
- **Configuration UX:** Installed-tool configuration opens in the same trusted GeckoUI dialog used by Forge candidate previews. Saving refreshes the current tool in place; configuration never navigates to a separate settings screen.
- **Verification:** Biome checks, TypeScript typecheck, 94 automated host/API/MCP/UI tests, production builds, live local HTTP, Codex-readiness and CSP checks, npm package dry runs, a manual image resize/preview/download acceptance run, and manual Codex terminal input/resize/refresh-reconnect checks. Manifest tests enforce the three-category limit, case-insensitive uniqueness, and legacy installed-tool normalization; Library tests cover manifest-derived counts plus category search/filter behavior; Forge session tests verify that the current category vocabulary is supplied to Codex. The Forge preference tests verify the safe default, migration of older local settings, and explicit bypass persistence; the session tests prove that the bypass CLI flag is absent by default and present only after opt-in, and that both the injected prompt and MCP server receive the matching dependency-install permission. MCP instruction tests also require Forge and Doctor to verify package names and pinned download sources before installation, and require generated browser libraries to be inlined rather than loaded from a CDN. Candidate tests accept inlined interfaces above the former 500 KB ceiling and enforce the new 3 MB per-file review boundary. The save integration test rejects an untested candidate, saves the successful exact revision, terminates its owning Forge PTY, and runs the installed copy through the normal library runtime. Requirement tests keep missing-dependency tools installed while rejecting only their run. Doctor tests prove that Codex starts only on request, opens inside tool detail, keeps proposal review exclusive from xterm, purges Codex replay output on approval, starts no installer before approval, closes after successful verification, and runs the exact executable and arguments. Read-only source tests cover both installed and bundled runner/manifest inspection without exposing `ui.html`. Archive tests cover complete nested-file round trips, unsafe and duplicate-path rejection, identifier collisions, typed UI submission, the Needs install execution boundary, confirmation-before-delete, and bundled deletion protection. Configuration tests cover authenticated encryption, candidate isolation, missing-field execution blocks, trusted dynamic forms, runner injection, event redaction, archive exclusion, and deletion cleanup. Card interaction tests verify whole-card navigation without an Open button, use a dedicated horizontal list composition, keep the actions menu from navigating accidentally, and cover stable color accents plus semantic status and Built-in badge tones. PDF runtime tests execute a real two-document reorder/merge with rotation, verify offline PDF.js hydration and CSP, and create a flattened scan-compressed PDF with truthful result metadata. The Silicon integration test resolves a declared executable from `PATH`, sends realistic code through the runner, and verifies a genuine PNG output lifecycle.
- **Primary Codex Session ID:** `019f7198-5cb2-74b2-96a8-c8909989d1b2`.

## Limitations and Future Work

- `.forge` archives currently have no signatures or provenance metadata; import is local and intentionally does not execute code.
- Local secret encryption prevents accidental disclosure and archive leakage, but it does not protect against an attacker who can read both the current user's configuration files and generated local master key.
- macOS is the first supported platform; Windows and Linux should fail clearly where a capability is unavailable.
- Code Screenshot Studio requires the separate Silicon executable; ScriptForge keeps it visible as Needs install and starts Doctor only when requested.

## License and Acknowledgements

A project license will be selected before publishing the judging repository. Built with OpenAI Codex, GPT-5.6, Hono, React, GeckoUI, Spoosh, Sharp, `pdf-lib` (MIT), PDF.js (Apache-2.0), and [Silicon](https://github.com/Aloxaf/silicon) (MIT).
