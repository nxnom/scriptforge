import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  clean: false,
  dts: false,
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
});
