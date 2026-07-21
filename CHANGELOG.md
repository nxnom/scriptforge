# Changelog

All notable changes to ScriptForge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Installed-tool edit sessions now replace the terminal with blocking question and approval plans, matching the new-tool Forge workspace.

## [0.1.7] - 2026-07-22

### Added

- The connected Forge terminal now offers a compact help menu with complete, copyable example prompts for creating useful local tools and exploring alternate UI layouts and color palettes.
- Library Import now accepts multiple `.forge` archives from one file-picker selection or drag-and-drop, shows batch progress, continues after individual failures, and reports per-file errors without executing imported code.

### Fixed

- Question-only Forge plan panels now include Request changes alongside Approve, with revision feedback returned to the active Codex session.

## [0.1.6] - 2026-07-21

### Changed

- Tool inputs no longer have ScriptForge's generic 25 MB per-file or 250 MB total upload limits.
- Bundled image tools no longer add their own file-size or image-pixel caps, and Forge now directs generated local tools to avoid arbitrary input limits.

## [0.1.5] - 2026-07-21

### Added

- ScriptForge now uses the brand-colored Zap mark as its browser favicon.

## [0.1.4] - 2026-07-21

### Added

- Built-in SMTP Campaign Sender for personalized CSV campaigns sent directly through a user-configured SMTP server, with encrypted credentials, attachments, throttling, test sends, and downloadable acceptance reports.

### Fixed

- Manifest-driven numeric configuration fields now submit actual numbers instead of failing validation after user edits.
- Long Library category lists, including All categories, now scroll within the available viewport without showing an oversized native scrollbar.

## [0.1.3] - 2026-07-20

### Changed

- Forge authoring guidance now requires folder-based tools to pair manual paths with a custom, runner-backed folder browser.
- Advertised drag-and-drop inputs must implement and verify real dropped-file handling.

### Fixed

- Image Resizer now accepts images dropped onto its picker instead of only changing the drop-zone styling.

## [0.1.2] - 2026-07-20

### Changed

- Condensed the README feature summary and moved implementation details below setup and verification.

## [0.1.1] - 2026-07-20

### Added

- MIT project license.
- npm package metadata for the repository, homepage, issue tracker, and discovery keywords.
- Published-package Quick Start and public npm verification evidence in the README.
- Changelog included in future npm package artifacts.
- Accessible GitHub repository link in the main Library header.
- Concise judge-facing README with Codex CLI setup and detailed architecture and Build Week evidence documents.

## [0.1.0] - 2026-07-20

### Added

- Local ScriptForge library launched through `npx scriptforge`.
- Seven bundled tools covering image resizing, PDF workflows, app icons, favicons, media conversion, code screenshots, and authorized video downloads.
- GPT-5.6-powered Forge sessions with an embedded Codex terminal, durable resume support, candidate review, direct Save, and installed-tool updates.
- Filesystem-backed user tools with encrypted configuration, `.forge` import/export, optimistic deletion, and dependency Doctor workflows.
- Typed Hono and Spoosh APIs plus WebSocket terminal and job lifecycle streams.

[Unreleased]: https://github.com/nxnom/scriptforge/compare/v0.1.7...HEAD
[0.1.7]: https://github.com/nxnom/scriptforge/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/nxnom/scriptforge/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/nxnom/scriptforge/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/nxnom/scriptforge/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/nxnom/scriptforge/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/nxnom/scriptforge/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/nxnom/scriptforge/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/nxnom/scriptforge/releases/tag/v0.1.0
