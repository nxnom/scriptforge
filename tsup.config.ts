import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/mcp.ts"],
  format: ["esm"],
  clean: false,
  dts: false,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
});
