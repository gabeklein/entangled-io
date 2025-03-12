import { defineConfig } from 'tsup';

export default defineConfig([
  {
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: "dist",
    target: "esnext",
    entry: { "index": "src/index.ts" },
    external: ["../runtime/fetch.ts"],
    format: ['cjs'],
  },
  {
    sourcemap: true,
    outDir: "dist",
    target: "esnext",
    entry: { "index": "src/index.ts" },
    format: ['esm'],
  }
]);