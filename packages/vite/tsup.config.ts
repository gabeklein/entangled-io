import { defineConfig } from 'tsup';

export default defineConfig([
  {
    dts: true,
    sourcemap: "inline",
    clean: true,
    outDir: "dist",
    target: "esnext",
    entry: {
      "index": "src/index.ts",
      "fetch": "src/fetch/index.ts",
    },
    format: ['cjs'],
  },
  {
    sourcemap: "inline",
    outDir: "dist",
    target: "esnext",
    entry: {
      "index": "src/index.ts",
      "fetch": "src/fetch/index.ts",
    },
    format: ['esm'],
  }
]);