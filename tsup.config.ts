import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.mts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  platform: 'node',
  outExtension({ format }) {
    // tsup v8 with package.json `"type": "module"` emits:
    //   ESM → .mjs + .d.ts   |   CJS → .cjs + .d.cts
    // (dts extension is decided by tsup's defaultOutExtension and ignores
    // a user-supplied dts override, so we don't try to set it here.)
    return format === 'esm' ? { js: '.mjs' } : { js: '.cjs' };
  },
});
