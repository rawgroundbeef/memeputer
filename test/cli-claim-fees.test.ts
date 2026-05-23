/**
 * Plan 06.1-06 Task 3 — CLI smoke tests for `memeputer rooms claim-fees`
 * + `memeputer rooms fee-balance`.
 *
 * Mirrors test/cli-dispatch.test.ts: integration via execFileSync against
 * the BUILT dist/cli.mjs. Asserts the dispatcher routes the new sub-
 * commands correctly + that --help lists them. Does NOT exercise the
 * end-to-end on-chain call path — that's covered by
 * test/rooms.claim-fees.test.ts at the SDK layer (mocked Anchor), and
 * the Plan 08 devnet E2E runbook will cover the live-chain path.
 *
 * The error-only paths (missing-mint, missing-keypair) are safe to
 * exercise because they fail BEFORE constructing a Memeputer client /
 * Connection — no real RPC call attempted.
 */
import { describe, test, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_BUILT = join(__dirname, '..', 'dist', 'cli.mjs');

function runCli(args: string[]): { exitCode: number; stdout: string; stderr: string } {
  let exitCode = 0;
  let stdout = '';
  let stderr = '';
  try {
    stdout = execFileSync('node', [CLI_BUILT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const err = e as { status: number; stdout?: string; stderr?: string };
    exitCode = err.status;
    stdout = err.stdout ?? '';
    stderr = err.stderr ?? '';
  }
  return { exitCode, stdout, stderr };
}

describe('CLI rooms claim-fees + fee-balance dispatch', () => {
  beforeAll(() => {
    if (!existsSync(CLI_BUILT)) {
      throw new Error(
        `CLI binary not found at ${CLI_BUILT}. Run \`pnpm --filter memeputer build\` first.`,
      );
    }
  });

  test('memeputer --help → lists rooms claim-fees + fee-balance', () => {
    const { exitCode, stdout } = runCli(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('memeputer rooms claim-fees');
    expect(stdout).toContain('memeputer rooms fee-balance');
    expect(stdout).toContain('--rpc-url');
  });

  test('memeputer rooms claim-fees (no mint) → exit 1 + usage to stderr', () => {
    const { exitCode, stderr } = runCli([
      'rooms',
      'claim-fees',
      '--keypair',
      '/tmp/does-not-exist.json',
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Missing mint positional arg');
    expect(stderr).toContain('memeputer rooms claim-fees <mint>');
  });

  test('memeputer rooms claim-fees <mint> (no --keypair) → exit 1', () => {
    const { exitCode, stderr } = runCli([
      'rooms',
      'claim-fees',
      'MintXyz1111111111111111111111111111111111',
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Missing required flag --keypair');
  });

  test('memeputer rooms fee-balance (no mint) → exit 1 + usage to stderr', () => {
    const { exitCode, stderr } = runCli(['rooms', 'fee-balance']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Missing mint positional arg');
    expect(stderr).toContain('memeputer rooms fee-balance <mint>');
  });

  test('CLI source contains the two new dispatcher branches (NO parallel code path — D-09)', async () => {
    // Belt-and-suspenders: even if execFileSync misses an edge case,
    // a literal grep confirms the dispatcher calls through to the SDK
    // methods rather than re-implementing the claim logic in the CLI.
    const { readFileSync } = await import('node:fs');
    const cliSrc = readFileSync(
      join(__dirname, '..', 'src', 'cli.mts'),
      'utf8',
    );
    expect(cliSrc).toMatch(/case 'claim-fees':/);
    expect(cliSrc).toMatch(/case 'fee-balance':/);
    expect(cliSrc).toMatch(/mp\.rooms\.claimFees\(/);
    expect(cliSrc).toMatch(/mp\.rooms\.feeBalance\(/);
    // bigint -> string coercion must be present (JSON.stringify can't
    // serialise bigints; this is the regression guard).
    expect(cliSrc).toMatch(/grossClaimed: result\.grossClaimed\.toString\(\)/);
  });
});
