# Example tools

These `.forge` archives are ready-to-import ScriptForge tools:

- `archive-maker.forge` — packs selected files and folders into a ZIP or TAR.GZ archive.
- `duplicate-file-finder.forge` — finds exact duplicate files and can move selected copies to Trash.
- `photo-background-studio.forge` — removes photo backgrounds and creates polished variants. It requires the `swift` executable.
- `swatch-studio-color-mixer.forge` — mixes colors, generates variations, and checks contrast.

## Import into ScriptForge

1. Start ScriptForge:

   ```bash
   npx scriptforge
   ```

2. In the Library, find **Add tools from .forge files**.
3. Click **Choose files** and select one or more archives from this folder, or drag the archives onto the import area.
4. Wait for the import confirmation. Successfully imported tools appear as cards in the Library.
5. Open a tool to review its Preview, Script, and Details before running it.

ScriptForge validates and extracts each archive without executing it during import. A tool that needs configuration or a missing executable still imports, but its Library card shows that setup is required before it can run. Dependency Doctor can help with a missing declared executable after import.

If a tool with the same ID is already installed, ScriptForge rejects that archive instead of overwriting the existing tool. Keep the installed copy, or delete it from its Library action menu and import the example again.

## Trust and local access

Imported tools are trusted local programs when you run them. Their `run.mjs` scripts use your operating-system account's normal filesystem, process, and network permissions. Review the Script and Details tabs first, especially before running a tool that can modify or move files.
