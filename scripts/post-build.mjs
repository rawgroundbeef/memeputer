import { readFileSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CLI = join('dist', 'cli.mjs');
if (!existsSync(CLI)) {
  console.error(`[post-build] ${CLI} not found — did tsup build the cli entry?`);
  process.exit(1);
}
const SHEBANG = '#!/usr/bin/env node\n';
const current = readFileSync(CLI, 'utf8');
if (!current.startsWith(SHEBANG)) {
  writeFileSync(CLI, SHEBANG + current, 'utf8');
}
chmodSync(CLI, 0o755);
console.log('[post-build] shebang + chmod applied to', CLI);
