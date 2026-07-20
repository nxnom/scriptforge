# ScriptForge

ScriptForge is a local app store where small utility apps do not exist until you ask Codex to forge them.

[![npm version](https://img.shields.io/npm/v/scriptforge.svg)](https://www.npmjs.com/package/scriptforge)

**OpenAI Build Week track:** Apps for Your Life

## Problem and Solution

Small file tasks often force people to search for a website, upload private files, install a large application, or write a script. ScriptForge keeps those workflows local. It starts as a useful library of focused tools and lets someone describe a missing utility to Codex with GPT-5.6, review the working interface, and save it into their personal library.

The result is one local workspace for everyday image, document, media, and file utilities—without turning every one-off need into a software project.

## Demo

The public video demonstration will be linked here before the Build Week submission deadline.

## Key Features

- Launch eight ready-to-use image, PDF, icon, favicon, code screenshot, media, download, and direct-SMTP email tools with one `npx scriptforge` command.
- Forge new utilities through a real interactive Codex CLI session powered by GPT-5.6.
- Review generated interfaces and scripts, save them locally, resume interrupted work, and update installed tools.
- Run tools with previews, progress, structured logs, cancellation, and optional Dependency Doctor guidance.
- Keep ownership local with encrypted configuration and portable, validated `.forge` archives.

## Prerequisites

- Node.js 20 or newer
- Codex CLI, only when using Forge or Dependency Doctor
- pnpm 10, only when developing from source

The bundled library works without Codex CLI. To create or update tools, install and authenticate Codex first:

```bash
npm install --global @openai/codex
codex login
```

`codex login` opens the browser sign-in flow. ScriptForge checks installation and authentication before starting Forge and shows guidance if either is missing; it never installs or authenticates Codex automatically.

See the official [Codex CLI documentation](https://learn.chatgpt.com/docs/codex/cli) for other installation and authentication options.

Some bundled tools have optional system dependencies. FFmpeg Media Toolkit requires `ffmpeg`, Code Screenshot Studio requires `silicon`, and Video Downloader requires `yt-dlp`. Missing dependencies keep a tool visible and block only its execution until resolved.

SMTP Campaign Sender requires access to an SMTP account. Its host, sender identity, username, and encrypted password or app password are saved through Tool configuration—not environment variables—and the secret is resolved only for the local Node.js runner.

## Quick Start

```bash
npx scriptforge
```

ScriptForge binds only to `127.0.0.1`, prefers port `4545`, chooses another available port when necessary, and opens the Library. To suppress browser opening:

```bash
npx scriptforge --no-open
```

[View the npm package](https://www.npmjs.com/package/scriptforge) · [Browse the source](https://github.com/nxnom/scriptforge)

## Develop from Source

```bash
git clone https://github.com/nxnom/scriptforge.git
cd scriptforge
pnpm install
pnpm dev
```

Create a production build with `pnpm build`, then start it with `node dist/cli.js`.

## Environment Variables

None are required. Do not place OpenAI credentials in this repository; Codex CLI manages its own authentication.

## Test and Sample Data

The image tools accept ordinary PNG, JPEG, or WebP files, so no separate sample dataset is required. A simple first test is to open **Image Resizer**, choose an image, resize it, and save the result. SMTP Campaign Sender accepts a CSV with an `email` header and any additional columns used as `{{variable}}` placeholders; use addresses you control when testing.

For repository verification:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm pack --dry-run
```

## How It Works

ScriptForge packages a Node.js CLI, localhost-only Hono server, React interface, and built assets as one npm package. REST operations use typed Hono and Spoosh calls; WebSockets carry terminal streams and real-time job events.

Forge launches Codex CLI with the selected GPT-5.6 model in a dedicated staging directory. A session-scoped MCP server helps Codex ask structured questions, exercise the generated runner, and present a candidate. The user remains responsible for the explicit Save action that adds the candidate to the filesystem-backed library.

Generated and installed tools are trusted local applications. Review tools before saving or importing them: their runners use the current user's normal filesystem, process, and network permissions.

See [Architecture](./docs/ARCHITECTURE.md) for the complete runtime and trust model.

## Build Week Evidence

- **Track:** Apps for Your Life. ScriptForge creates focused local utilities for everyday file and media workflows.
- **GPT-5.6:** Forge defaults to `gpt-5.6-sol` in `src/web/forge/preferences.ts`; `src/server/forge/service.ts` passes the selected model to Codex CLI.
- **User-facing model role:** GPT-5.6 collaborates with the user, creates and exercises tool candidates, repairs failures, and presents exact revisions for review and saving. It also powers the optional Dependency Doctor diagnosis flow.
- **Codex acceleration:** Codex helped define the product and trust model, implement the Hono/Spoosh boundary, build the generic runner and Forge terminal, diagnose PTY and iframe integration, create the bundled tools, and write verification tests.
- **Key decisions:** ScriptForge uses filesystem manifests instead of a database, keeps the server on localhost, preserves explicit Save as the installation boundary, and treats reviewed tools as trusted local code.
- **Verification:** Biome, TypeScript, 132 automated tests, production builds, isolated npm package installation, HTTP/WebSocket lifecycle checks, a real bundled image-resizer output, and direct SMTP delivery through Mailpit have passed.
- **Primary Codex Session ID:** `019f7198-5cb2-74b2-96a8-c8909989d1b2`

See [Build Week Evidence](./docs/BUILD_WEEK_EVIDENCE.md) for the detailed implementation decisions and evaluation record.

## Documentation

- [Architecture and trust model](./docs/ARCHITECTURE.md)
- [Build Week evidence and evaluations](./docs/BUILD_WEEK_EVIDENCE.md)
- [Product definition](./docs/PRODUCT.md)
- [Milestones and acceptance checks](./docs/GOALS.md)
- [Tool authoring contract](./docs/TOOL_AUTHORING.md)
- [Portable tool archive format](./docs/TOOL_ARCHIVES.md)
- [Release history](./CHANGELOG.md)

## Limitations and Future Work

- macOS is the primary tested platform; Windows and Linux should fail clearly where a capability is unavailable.
- `.forge` archives do not yet include signatures or provenance metadata, so users should import only trusted tools.
- Local encryption prevents accidental secret disclosure but cannot protect against an attacker who can read both the local key and configuration files.
- Results from FFmpeg, `yt-dlp`, and Silicon depend on the separately installed executable and its platform capabilities.

## License and Acknowledgements

ScriptForge is released under the [MIT License](./LICENSE). Release history is available in the [changelog](./CHANGELOG.md).

Built with OpenAI Codex, GPT-5.6, Hono, React, GeckoUI, Spoosh, Sharp, `pdf-lib` (MIT), PDF.js (Apache-2.0), [FFmpeg](https://ffmpeg.org/), [Silicon](https://github.com/Aloxaf/silicon) (MIT), and [yt-dlp](https://github.com/yt-dlp/yt-dlp) (Unlicense).
