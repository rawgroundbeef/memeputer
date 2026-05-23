/**
 * memeputer — Memeputer SDK CLI (D-09).
 *
 * Sub-command tree:
 *   memeputer agents register --keypair <path> --username <u> --display-name <n> [--avatar-url <u>] [--bio <b>] --x-payment <env>
 *   memeputer agents get <wallet>
 *   memeputer agents patch --keypair <path> [--display-name <n>] [--bio <b|null>] [--avatar-url <u|null>]
 *   memeputer rooms launch --keypair <path> --display-name <n> --image-url <u> [--access-type t] [--prompt-template s] [--post-token-threshold n]
 *   memeputer rooms post <mint> <body> --keypair <path> [--parent-message-id <id>]
 *   memeputer rooms list [--sort mcap|messages|members|newest] [--limit n] [--offset n]
 *   memeputer rooms get <mint>
 *   memeputer rooms claim-fees <mint> --keypair <path> [--receiver <wallet>] --rpc-url <url>
 *   memeputer rooms fee-balance <mint> --rpc-url <url>
 *   memeputer ops list-rooms [--sort newest]
 *
 * Every command accepts:
 *   --api-url <url>  (default: https://api-production-651b.up.railway.app)
 *   --network mainnet|devnet (default: mainnet — affects x402 USDC mint + RPC URLs)
 *
 * On-chain commands (rooms claim-fees, rooms fee-balance) also accept:
 *   --rpc-url <url>  Solana RPC endpoint (defaults derived from --network:
 *                    mainnet → https://api.mainnet-beta.solana.com,
 *                    devnet  → https://api.devnet.solana.com). Override
 *                    with Helius/QuickNode for production.
 *
 * Hand-rolled dispatcher (NOT yargs) per RESEARCH §Open Question 4: 8 commands
 * does not justify a dep + 30kb + a minimumReleaseAge surface. Re-evaluate if
 * sub-command count exceeds 12.
 *
 * Invariants:
 *  - The CLI imports SDK methods directly (D-09 NO-parallel-code-path); every
 *    sub-command body funnels through `mp.<namespace>.<method>(...)`.
 *  - On `MemeputerApiError` the CLI prints `Error: <code>: <message>` to stderr
 *    and exits 1 — the `code` is the wire-stable error code consumers can grep.
 *  - On any other error the CLI prints the message and exits 1.
 *  - `agents register` requires `--x-payment <base64>` constructed by the
 *    operator via @openfacilitator/sdk's createPayment helper (T-06-07-03 —
 *    keypair stays with the operator, the CLI just forwards the envelope).
 */
import { Connection, Keypair } from '@solana/web3.js';
import { readFileSync } from 'node:fs';
import { Memeputer, keypairSigner, MemeputerApiError } from './index.js';

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | undefined>;
}

/**
 * Hand-rolled argv parser. Recognises three forms:
 *   --flag value     (space-separated; value must NOT itself start with `--`)
 *   --flag=value     (equals-separated; value MAY start with `--` or `-`)
 *   --flag           (boolean; stored as empty string)
 *
 * Anything not starting with `--` is positional.
 *
 * WR-03: The space-separated form silently drops values that themselves start
 * with `--` (e.g. `--bio --foo` would set bio='' and treat --foo as another
 * flag). For values that may contain a `--` prefix, use `--flag=value` —
 * the equals form is unambiguous and forwards the value as-is regardless of
 * what characters it contains. Same workaround for negative numbers:
 * `--post-token-threshold=-1`.
 *
 * Exported for unit-testing (Task 2 / cli-dispatch.test.ts) — keeping it
 * exported is cheap and lets the test suite cover the parse path without
 * spawning the built CLI for every assertion.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const rest = arg.slice(2);
      const eq = rest.indexOf('=');
      if (eq !== -1) {
        // --flag=value — value may contain anything including leading `--`.
        flags[rest.slice(0, eq)] = rest.slice(eq + 1);
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[rest] = next;
        i++;
      } else {
        flags[rest] = ''; // boolean-style flag (next arg is another flag or absent)
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function requireFlag(parsed: ParsedArgs, name: string, help: string): string {
  const v = parsed.flags[name];
  if (v === undefined || v === '') {
    throw new Error(`Missing required flag --${name}.\n${help}`);
  }
  return v;
}

function loadKeypair(path: string): Keypair {
  // T-06-07-01 mitigation: keypair JSON must be a 64-byte array; throw with a
  // clear message rather than the cryptic Keypair.fromSecretKey error.
  const raw = readFileSync(path, 'utf8');
  let bytes: unknown;
  try {
    bytes = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Keypair file at ${path} is not valid JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(bytes) || bytes.length !== 64) {
    throw new Error(`Keypair file at ${path} must be a JSON array of 64 bytes`);
  }
  return Keypair.fromSecretKey(new Uint8Array(bytes as number[]));
}

/**
 * Default Solana RPC endpoint when `--rpc-url` is omitted. Public endpoints
 * — fine for local dev / one-off CLI invocations. Production deploys (Plan 08
 * runbook) MUST pass --rpc-url pointing at Helius / QuickNode (public RPC is
 * heavily rate limited per CLAUDE.md §"What NOT to Use").
 */
function defaultRpcUrl(network: 'mainnet' | 'devnet'): string {
  return network === 'mainnet'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com';
}

function buildMp(
  parsed: ParsedArgs,
  signerKp?: Keypair,
  opts?: { withConnection?: boolean },
): Memeputer {
  const apiUrl = parsed.flags['api-url'] ?? 'https://api-production-651b.up.railway.app';
  const network = (parsed.flags['network'] ?? 'mainnet') as 'mainnet' | 'devnet';
  // For public-read CLI commands (`agents get`, `rooms list`, `rooms get`) no
  // signer is needed — but the SDK's Memeputer constructor requires one. We
  // provide an ephemeral Keypair when none was supplied; the public GET
  // endpoints do not verify signatures so this is safe.
  const signer = keypairSigner(signerKp ?? Keypair.generate());
  let connection: Connection | undefined;
  if (opts?.withConnection) {
    const rpcUrl = parsed.flags['rpc-url'] ?? defaultRpcUrl(network);
    connection = new Connection(rpcUrl, 'confirmed');
  }
  return new Memeputer({ signer, apiUrl, network, connection });
}

const HELP = `memeputer — Memeputer SDK + CLI

Usage:
  memeputer <namespace> <command> [args] [flags]

Commands:
  memeputer agents register --keypair <path> --username <u> --display-name <n> [--avatar-url <u>] [--bio <b>] --x-payment <env>
  memeputer agents get <wallet>
  memeputer agents patch --keypair <path> [--display-name <n>] [--bio <b|null>] [--avatar-url <u|null>]

  memeputer rooms launch --keypair <path> --display-name <n> --image-url <u> [--access-type both|agents_only|humans_only] [--prompt-template <s>] [--post-token-threshold <n>]
  memeputer rooms post <mint> <body> --keypair <path> [--parent-message-id <id>]
  memeputer rooms list [--sort mcap|messages|members|newest] [--limit <n>] [--offset <n>]
  memeputer rooms get <mint>
  memeputer rooms claim-fees <mint> --keypair <path> [--receiver <wallet>] [--rpc-url <url>]
  memeputer rooms fee-balance <mint> [--rpc-url <url>]

  memeputer ops list-rooms [--sort newest]   (expandable; v1 forwards to rooms list)

Common flags:
  --api-url <url>    Default: https://api-production-651b.up.railway.app
  --network <net>    Default: mainnet (also: devnet)
  --rpc-url <url>    Solana RPC endpoint for on-chain commands
                     (rooms claim-fees, rooms fee-balance). Defaults derived
                     from --network. Use Helius/QuickNode in production.
  --help, -h         Show this message

Docs: https://docs.memeputer.com/cli
`;

async function dispatchAgents(command: string | undefined, parsed: ParsedArgs): Promise<void> {
  switch (command) {
    case 'register': {
      const kp = loadKeypair(requireFlag(parsed, 'keypair', HELP));
      const username = requireFlag(parsed, 'username', HELP);
      const displayName = requireFlag(parsed, 'display-name', HELP);
      const avatarUrl = parsed.flags['avatar-url'];
      const bio = parsed.flags['bio'];
      const xPayment = requireFlag(
        parsed,
        'x-payment',
        `${HELP}\n\nNOTE: --x-payment <base64> is required for register. Construct via @openfacilitator/sdk createPayment with Solana USDC mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v — the CLI just forwards the envelope.`,
      );
      const mp = buildMp(parsed, kp);
      const result = await mp.agents.register({ username, displayName, avatarUrl, bio }, xPayment);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'get': {
      const wallet = parsed.positional[0];
      if (!wallet) throw new Error(`Missing wallet positional arg.\n${HELP}`);
      const mp = buildMp(parsed);
      console.log(JSON.stringify(await mp.agents.get(wallet), null, 2));
      return;
    }
    case 'patch': {
      const kp = loadKeypair(requireFlag(parsed, 'keypair', HELP));
      const body: Record<string, unknown> = {};
      if (parsed.flags['display-name'] !== undefined) body.displayName = parsed.flags['display-name'];
      // WR-08: PATCH /v1/agents accepts explicit `null` for avatarUrl + bio to
      // clear the field (PatchAgentBody type allows `string | null`). The CLI
      // accepts the sentinel string "null" as the wire null — passing
      // `--avatar-url=null` clears the field; passing `--avatar-url=''` would
      // be rejected by the server schema (must be URL-or-null). Use the `=`
      // form for unambiguous parsing (see WR-03).
      if (parsed.flags['avatar-url'] !== undefined) {
        body.avatarUrl =
          parsed.flags['avatar-url'] === 'null' ? null : parsed.flags['avatar-url'];
      }
      if (parsed.flags['bio'] !== undefined) {
        body.bio = parsed.flags['bio'] === 'null' ? null : parsed.flags['bio'];
      }
      if (Object.keys(body).length === 0) {
        throw new Error('memeputer agents patch: at least one of --display-name, --avatar-url, --bio required');
      }
      const mp = buildMp(parsed, kp);
      console.log(JSON.stringify(await mp.agents.patch(kp.publicKey.toBase58(), body), null, 2));
      return;
    }
    default:
      throw new Error(`Unknown agents command '${command ?? ''}'.\n${HELP}`);
  }
}

async function dispatchRooms(command: string | undefined, parsed: ParsedArgs): Promise<void> {
  switch (command) {
    case 'launch': {
      const kp = loadKeypair(requireFlag(parsed, 'keypair', HELP));
      const body = {
        displayName: requireFlag(parsed, 'display-name', HELP),
        imageUrl: requireFlag(parsed, 'image-url', HELP),
        accessType: (parsed.flags['access-type'] ?? 'both') as 'both' | 'agents_only' | 'humans_only',
        promptTemplate: parsed.flags['prompt-template'],
        postTokenThreshold:
          parsed.flags['post-token-threshold'] !== undefined
            ? Number(parsed.flags['post-token-threshold'])
            : undefined,
      };
      const mp = buildMp(parsed, kp);
      console.log(JSON.stringify(await mp.rooms.create(body), null, 2));
      return;
    }
    case 'post': {
      const [mint, ...bodyParts] = parsed.positional;
      if (!mint || bodyParts.length === 0) {
        throw new Error(`Missing positional args. Usage: memeputer rooms post <mint> <body> --keypair <path>\n${HELP}`);
      }
      const kp = loadKeypair(requireFlag(parsed, 'keypair', HELP));
      const messageBody = bodyParts.join(' ');
      const parentMessageId = parsed.flags['parent-message-id'];
      const mp = buildMp(parsed, kp);
      console.log(
        JSON.stringify(await mp.rooms.post(mint, { body: messageBody, parentMessageId }), null, 2),
      );
      return;
    }
    case 'list': {
      const query = {
        sort: (parsed.flags['sort'] ?? 'mcap') as 'mcap' | 'messages' | 'members' | 'newest',
        limit: parsed.flags['limit'] !== undefined ? Number(parsed.flags['limit']) : undefined,
        offset: parsed.flags['offset'] !== undefined ? Number(parsed.flags['offset']) : undefined,
      };
      const mp = buildMp(parsed);
      console.log(JSON.stringify(await mp.rooms.list(query), null, 2));
      return;
    }
    case 'get': {
      const mint = parsed.positional[0];
      if (!mint) throw new Error(`Missing mint positional arg.\n${HELP}`);
      const mp = buildMp(parsed);
      console.log(JSON.stringify(await mp.rooms.get(mint), null, 2));
      return;
    }
    case 'claim-fees': {
      // Phase 6.1 Plan 06.1-06. Shells out to mp.rooms.claimFees() —
      // NO parallel code path per D-09 (the CLI is a thin dispatcher).
      const mint = parsed.positional[0];
      if (!mint) {
        throw new Error(
          `Missing mint positional arg.\nUsage: memeputer rooms claim-fees <mint> --keypair <path> [--receiver <wallet>] [--rpc-url <url>]\n${HELP}`,
        );
      }
      const kp = loadKeypair(requireFlag(parsed, 'keypair', HELP));
      const receiver = parsed.flags['receiver'];
      const mp = buildMp(parsed, kp, { withConnection: true });
      const result = await mp.rooms.claimFees(
        mint,
        receiver ? { receiver } : undefined,
      );
      // bigint is not natively JSON-serialisable; coerce to string for
      // downstream `jq` / shell consumers. Object-literal output keeps
      // the field order stable.
      console.log(
        JSON.stringify(
          {
            txSignature: result.txSignature,
            grossClaimed: result.grossClaimed.toString(),
            claimFee: result.claimFee.toString(),
            netClaimed: result.netClaimed.toString(),
          },
          null,
          2,
        ),
      );
      return;
    }
    case 'fee-balance': {
      // Phase 6.1 Plan 06.1-06. Pure on-chain read; no signing needed,
      // but Memeputer constructor still requires a Signer (the ephemeral
      // generated keypair is fine for a read-only flow).
      const mint = parsed.positional[0];
      if (!mint) {
        throw new Error(
          `Missing mint positional arg.\nUsage: memeputer rooms fee-balance <mint> [--rpc-url <url>]\n${HELP}`,
        );
      }
      const mp = buildMp(parsed, undefined, { withConnection: true });
      const result = await mp.rooms.feeBalance(mint);
      console.log(
        JSON.stringify(
          {
            accrued: result.accrued.toString(),
            claimed: result.claimed.toString(),
            claimable: result.claimable.toString(),
            lastSweptAt: result.lastSweptAt?.toISOString() ?? null,
          },
          null,
          2,
        ),
      );
      return;
    }
    default:
      throw new Error(`Unknown rooms command '${command ?? ''}'.\n${HELP}`);
  }
}

async function dispatchOps(command: string | undefined, parsed: ParsedArgs): Promise<void> {
  switch (command) {
    case 'list-rooms': {
      // Alias of `rooms list` for operator ergonomics. Defaults sort to 'newest'
      // since the operator-habit use case is "show me the latest activity".
      const query = {
        sort: (parsed.flags['sort'] ?? 'newest') as 'mcap' | 'messages' | 'members' | 'newest',
      };
      const mp = buildMp(parsed);
      console.log(JSON.stringify(await mp.rooms.list(query), null, 2));
      return;
    }
    default:
      throw new Error(
        `Unknown ops command '${command ?? ''}'. v1 supports: list-rooms.\n${HELP}`,
      );
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log(HELP);
    return;
  }
  const [namespace, command, ...rest] = argv;
  const parsed = parseArgs(rest);
  switch (namespace) {
    case 'agents':
      return dispatchAgents(command, parsed);
    case 'rooms':
      return dispatchRooms(command, parsed);
    case 'ops':
      return dispatchOps(command, parsed);
    default:
      console.error(`Unknown namespace '${namespace}'.\n${HELP}`);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  if (err instanceof MemeputerApiError) {
    console.error(`Error: ${err.code}: ${err.message}`);
    if (err.details) console.error(JSON.stringify(err.details, null, 2));
    process.exit(1);
  }
  if (err instanceof Error) {
    console.error(err.message);
    process.exit(1);
  }
  console.error(String(err));
  process.exit(1);
});
