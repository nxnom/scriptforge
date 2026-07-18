# ScriptForge

ScriptForge is a local app store where small utility apps do not exist until you ask Codex to forge them.

**OpenAI Build Week track:** Apps for your life

## Status

The local application shell, bundled image-resizer workflow, and full MCP-guided Forge-to-library flow are working. The dependency Doctor and submission assets are being built milestone by milestone.

## Key Features

- Local-only Hono server and React library launched from one CLI package
- GeckoUI application shell based on the checked-in Pencil design
- Hono-to-Spoosh inferred REST types with caching, in-flight deduplication, and automatic invalidation
- Preferred `127.0.0.1:4545` address with automatic port fallback
- Sandboxed plain-HTML tool interfaces connected to a controlled host bridge
- Bundled Sharp image resizer with progress, structured logs, before/after previews, and local result download
- Codex CLI installation/authentication preflight with locally remembered model and effort choices
- Real embedded Codex TUI launched in a staging directory using the user's Codex permission configuration, with terminal reconnection after browser refresh
- Mandatory plain-language kickoff approval with required questions and separate Markdown, Mermaid, and HTML blocks
- Side-by-side terminal and sandboxed candidate preview with read-only Script and Details tabs
- Kickoff-authorized standalone runner checks before Codex can present a candidate
- Candidate tester with lifecycle events, bridge diagnostics, zero-file runs, and data or file results
- Exact tested-revision saving into the filesystem-backed library
- Explicit Stop and New session controls for the embedded Codex terminal
- Planned dependency Doctor

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
- A session-scoped stdio MCP server gives Codex structured question, approval, and candidate-presentation tools; candidate presentation requires a summary of the real standalone check Codex completed.
- Forge prefers Node.js built-ins such as `fetch` before declaring system executables.

## Environment Variables

None are required for the current milestone. Never commit OpenAI credentials or Codex authentication data.

## Sample Data

The bundled image resizer accepts a local PNG, JPEG, or WebP file, so no separate sample dataset is required. It is powered by `sharp` and requires no system executable.

## Build Week Evidence

- **Track:** Apps for your life — ScriptForge lets people create focused local utilities for everyday files and workflows.
- **GPT-5.6 model:** The Forge preflight defaults to `gpt-5.6-sol` in `src/web/forge/preferences.ts`; `src/server/forge/service.ts` passes the selected model explicitly to every Codex CLI session.
- **GPT-5.6-powered features:** GPT-5.6 proposes each utility in plain language, asks structured questions when needed, waits for approval, builds and exercises the standalone runner with realistic input, repairs failures, and presents tested staged candidates for code and UI review beside the live terminal. Dependency diagnosis remains planned for Goal 4.
- **Codex acceleration:** Codex helped define the safety model, inspect the Pencil design, configure the typed Hono/Spoosh boundary, implement the local shell and generic tool runtime, diagnose the sandbox bridge and PTY integration, and write verification tests.
- **Key decisions:** Filesystem manifests instead of a database; localhost-only server; one server-owned in-memory Forge PTY; Forge does not override the user's Codex sandbox or approval settings; blocking kickoff panels temporarily replace the terminal and close immediately on submission; kickoff approval authorizes standalone checks in staging; candidate testers run the exact presented revision; runner results match the tool as structured data and/or real file outputs instead of forced snapshots; generated interfaces use a network-blocked sandboxed iframe; Save copies only the exact successfully tested revision and remains separately user-controlled.
- **Verification:** Biome checks, TypeScript typecheck, 33 automated host/API/MCP/UI tests, production builds, live local HTTP, Codex-readiness and CSP checks, npm package dry runs, a manual image resize/preview/download acceptance run, and manual Codex terminal input/resize/refresh-reconnect checks. The save integration test rejects an untested candidate, saves the successful exact revision, and runs the installed copy through the normal library runtime.
- **Primary Codex Session ID:** `019f7198-5cb2-74b2-96a8-c8909989d1b2`.

## Limitations and Future Work

- Dependency Doctor is not implemented yet.
- Import/export sharing is intentionally postponed until after the hackathon MVP.
- macOS is the first supported platform; Windows and Linux should fail clearly where a capability is unavailable.

## License and Acknowledgements

A project license will be selected before publishing the judging repository. Built with OpenAI Codex, GPT-5.6, Hono, React, GeckoUI, and Spoosh.
