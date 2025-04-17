import { defineConfig } from 'tsup';

export default defineConfig([
  {
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: "dist",
    target: "esnext",
    entry: ["src/index.ts"],
    format: ['cjs'],
  },
  {
    sourcemap: true,
    outDir: "dist",
    target: "esnext",
    entry: ["src/index.ts"],
    format: ['esm'],
  }
]);