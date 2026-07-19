# ScriptForge Tool Archives

ScriptForge uses the `.forge` extension for a portable, complete tool directory. The file is UTF-8 JSON so the format remains dependency-free and inspectable.

```json
{
  "format": "scriptforge-tool",
  "formatVersion": 1,
  "files": [
    {
      "path": "tool.json",
      "encoding": "base64",
      "content": "..."
    }
  ]
}
```

Every regular file under an installed tool directory is included, including nested supporting files. Empty directories and symbolic links are not represented.

Forge-generated MVP tools are saved as exactly `tool.json`, `run.mjs`, and `ui.html`. Therefore a browser library used by a generated interface is portable only when its permitted distribution is inlined into `ui.html`; a separate staging-only vendor file is not installed. CDN references are not portable runtime dependencies and are blocked by the tool iframe policy. With an inlined library, export and import preserve the exact HTML bytes, including the library and its license notice.

## Import contract

- The upload must use the `.forge` extension and be at most 25 MB.
- The expanded regular-file payload must be at most 20 MB and contain at most 256 files.
- Paths are forward-slash relative paths. Absolute paths, backslashes, empty segments, `.` segments, `..` segments, NUL bytes, duplicates, and paths longer than 240 characters are rejected.
- `tool.json`, `run.mjs`, and `ui.html` are required and must match the manifest's supported MVP layout.
- The manifest must pass the normal ScriptForge schema and cannot replace a bundled or installed identifier.
- Extraction happens in a temporary sibling directory followed by an atomic rename.
- Import never evaluates `run.mjs` or loads `ui.html`.
- Declared executable requirements are checked only after installation. Missing executables produce Needs install and block runs, not import.

The archive currently provides portability, not authenticity. Signing and provenance metadata remain future work.

## Local deletion

Tools saved from Forge or reconstructed through Import may be deleted after an explicit confirmation. ScriptForge first renames the tool directory out of the visible library namespace, then removes it recursively. Bundled starter tools are not stored in that namespace and the API rejects attempts to delete their identifiers.
