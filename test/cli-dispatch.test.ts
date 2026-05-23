/**
 * Slice G — CLI dispatch tests.
 *
 * Two layers:
 *  1. Unit tests for `parseArgs()` — the pure argv → { positional, flags }
 *     transform. Exported from cli.mts for testability.
 *  2. Integration tests against the BUILT `dist/cli.mjs` via execFileSync —
 *     exercises the shebang, top-level dispatch, exit codes, and stderr
 *     formatting that consumers (operators, shell scripts) actually depend on.
 *
 * The integration tests are deliberately scoped to the read-only paths
 * (`--help`, `unknown-namespace`). Round-tripping `agents register` etc.
 * requires either a mock HTTP server or a real Solana keypair + USDC funded
 * wallet — out of scope for the unit-test layer; the SDK contract tests
 * (apps/api/test/sdk-contract.test.ts) cover the request shape.
 */
import { describe, test, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Import parseArgs directly from the .mts source. Vitest's resolver honours
// the file extension on .mts files (W3 note in PLAN: `.js` would work for
// vite-node convention on .ts sources, but cli.mts is .mts and resolves via
// .mjs). See packages/sdk/vitest.config.ts — no aliases, default resolver.
import { parseArgs } from '../src/cli.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_BUILT = join(__dirname, '..', 'dist', 'cli.mjs');

describe('CLI parseArgs', () => {
  test('flag with value', () => {
    expect(parseArgs(['--keypair', 'foo.json', '--username', 'a'])).toEqual({
      positional: [],
      flags: { keypair: 'foo.json', username: 'a' },
    });
  });

  test('boolean-style flag (next arg is also a flag)', () => {
    expect(parseArgs(['--help', '--api-url', 'x'])).toEqual({
      positional: [],
      flags: { help: '', 'api-url': 'x' },
    });
  });

  test('positional + flags preserves positional order', () => {
    expect(parseArgs(['MintX', 'Hello world', '--keypair', 'foo'])).toEqual({
      positional: ['MintX', 'Hello world'],
      flags: { keypair: 'foo' },
    });
  });

  test('flag without value (last arg)', () => {
    expect(parseArgs(['--api-url'])).toEqual({
      positional: [],
      flags: { 'api-url': '' },
    });
  });

  test('empty argv → empty result', () => {
    expect(parseArgs([])).toEqual({ positional: [], flags: {} });
  });

  test('flags-after-positional pattern (typical rooms post invocation)', () => {
    // `memeputer rooms post <mint> <body> --keypair ./kp.json --parent-message-id MSG-42`
    // After `rooms post` is stripped by main(), rest is the remainder below.
    expect(
      parseArgs(['MintABC', 'gm', 'cypherpunks', '--keypair', './kp.json', '--parent-message-id', 'MSG-42']),
    ).toEqual({
      positional: ['MintABC', 'gm', 'cypherpunks'],
      flags: { keypair: './kp.json', 'parent-message-id': 'MSG-42' },
    });
  });

  // WR-03: equals-separated form handles values that start with `--` (or `-`),
  // which the space-separated form silently treats as another flag.
  test('--flag=value form forwards values with `--` or `-` prefixes verbatim', () => {
    expect(parseArgs(['--bio=--leading-dashes-in-bio'])).toEqual({
      positional: [],
      flags: { bio: '--leading-dashes-in-bio' },
    });
    expect(parseArgs(['--post-token-threshold=-1'])).toEqual({
      positional: [],
      flags: { 'post-token-threshold': '-1' },
    });
  });

  test('--flag= form (empty value via equals) sets empty string', () => {
    expect(parseArgs(['--bio='])).toEqual({
      positional: [],
      flags: { bio: '' },
    });
  });
});

describe('CLI top-level dispatch (built binary)', () => {
  // Sanity-check the built artifact exists. If a previous task skipped
  // `pnpm --filter memeputer build` the integration tests would otherwise
  // crash with a cryptic ENOENT.
  beforeAll(() => {
    if (!existsSync(CLI_BUILT)) {
      throw new Error(
        `CLI binary not found at ${CLI_BUILT}. Run \`pnpm --filter memeputer build\` first.`,
      );
    }
  });

  test('memeputer (no args) → prints help + exit 0', () => {
    const out = execFileSync('node', [CLI_BUILT], { encoding: 'utf8' });
    expect(out).toContain('memeputer agents register');
    expect(out).toContain('memeputer rooms launch');
    expect(out).toContain('memeputer ops list-rooms');
    expect(out).toContain('docs.memeputer.com/cli');
  });

  test('memeputer --help → prints help + exit 0', () => {
    const out = execFileSync('node', [CLI_BUILT, '--help'], { encoding: 'utf8' });
    expect(out).toContain('memeputer agents register');
  });

  test('memeputer -h → prints help + exit 0 (short flag)', () => {
    const out = execFileSync('node', [CLI_BUILT, '-h'], { encoding: 'utf8' });
    expect(out).toContain('memeputer agents register');
  });

  test('memeputer unknown-namespace → exit 1', () => {
    let exitCode = 0;
    let stderr = '';
    try {
      execFileSync('node', [CLI_BUILT, 'unknown-namespace'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      const err = e as { status: number; stderr: string };
      exitCode = err.status;
      stderr = err.stderr ?? '';
    }
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown namespace 'unknown-namespace'");
  });
});
