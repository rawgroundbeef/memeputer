/**
 * Plan 06.1-06 Task 2 — Vitest coverage for `mp.rooms.claimFees` +
 * `mp.rooms.feeBalance`.
 *
 * Strategy: mock `@coral-xyz/anchor` so Program returns a fixture-driven
 * shape ({ account.feeLedger.fetch, account.platformConfig.fetch,
 * methods.claimCreatorReward(...).accounts(...).instruction }). Mock the
 * Connection methods used by claimFees (getLatestBlockhash, sendTransaction,
 * confirmTransaction) so no real RPC round-trip happens.
 *
 * Asserted invariants:
 *  1. Happy path — full ix build + send → returns ClaimFeesResult with
 *     bigint amounts AND correct fee math (1% bps deduction).
 *  2. WRONG_SIGNER — fires BEFORE any sendTransaction call (guard 1 of 2
 *     for the on-chain creator-wallet constraint).
 *  3. LEDGER_NOT_INITIALIZED — Anchor fetch reject wraps as a 404
 *     MemeputerApiError with the mint in details.
 *  4. CLAIM_BELOW_MINIMUM — claimable < MIN_CLAIM_LAMPORTS (100_000n)
 *     throws BEFORE any sendTransaction call.
 *  5. opts.receiver redirect — recipient arg + accounts.recipient both
 *     reflect the override pubkey.
 *  6. feeBalance happy path — bigint coercion + lastSweptAt Date.
 *  7. feeBalance with lastSweptAt = 0 → null sentinel.
 *  8. feeBalance LEDGER_NOT_INITIALIZED.
 *  9. RPC_FAILED — sendTransaction reject wraps as MemeputerApiError.
 *
 * NOTE: This test mocks the @coral-xyz/anchor module BEFORE importing the
 * SDK so vitest's hoist behaviour applies. We do NOT spin up a real
 * Connection — see init-platform-config.ts (Plan 03 output) for the
 * integration smoke against the live devnet program.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  Keypair,
  PublicKey,
  type Connection,
  type VersionedTransaction,
} from '@solana/web3.js';

// Module-scoped state for the Anchor mock. Each test resets these via
// the `setup()` helper so per-test fixtures don't bleed between cases.
type MockFeeLedger = {
  bump: number;
  mint: PublicKey;
  creatorWallet: PublicKey;
  accrued: { toString(): string };
  claimed: { toString(): string };
  lastSweptAt: { toString(): string };
  lastClaimAt: { toString(): string };
  reserved: number[];
};
type MockPlatformConfig = {
  bump: number;
  authority: PublicKey;
  claimFeeBps: { toString(): string };
  platformFeeRecipient: PublicKey;
  reserved: number[];
};

interface MockState {
  feeLedger: MockFeeLedger | Error; // Error → fetch rejects
  platformConfig: MockPlatformConfig;
  capturedReceiverArg: PublicKey | null; // for the .receiver-redirect test
  capturedAccountsArg: Record<string, PublicKey> | null;
}

const mockState: MockState = {
  feeLedger: new Error('placeholder'),
  platformConfig: {
    bump: 255,
    authority: PublicKey.default,
    claimFeeBps: { toString: () => '100' }, // 1%
    platformFeeRecipient: new PublicKey('11111111111111111111111111111112'),
    reserved: [],
  },
  capturedReceiverArg: null,
  capturedAccountsArg: null,
};

vi.mock('@coral-xyz/anchor', () => {
  class FakeProgram {
    public readonly account: {
      feeLedger: { fetch: (pda: PublicKey) => Promise<MockFeeLedger> };
      platformConfig: { fetch: (pda: PublicKey) => Promise<MockPlatformConfig> };
    };
    public readonly methods: {
      claimCreatorReward: (receiver: PublicKey) => {
        accounts: (accts: Record<string, PublicKey>) => {
          instruction: () => Promise<{ programId: PublicKey; keys: []; data: Buffer }>;
        };
      };
    };
    constructor() {
      this.account = {
        feeLedger: {
          fetch: async () => {
            if (mockState.feeLedger instanceof Error) throw mockState.feeLedger;
            return mockState.feeLedger;
          },
        },
        platformConfig: {
          fetch: async () => mockState.platformConfig,
        },
      };
      this.methods = {
        claimCreatorReward: (receiver: PublicKey) => {
          mockState.capturedReceiverArg = receiver;
          return {
            accounts: (accts: Record<string, PublicKey>) => {
              mockState.capturedAccountsArg = accts;
              return {
                instruction: async () => ({
                  programId: new PublicKey('11111111111111111111111111111111'),
                  keys: [],
                  data: Buffer.alloc(0),
                }),
              };
            },
          };
        },
      };
    }
  }
  class FakeAnchorProvider {
    constructor(_c: unknown, _w: unknown) {
      // no-op; the test doesn't exercise provider RPC
    }
  }
  return {
    Program: FakeProgram,
    AnchorProvider: FakeAnchorProvider,
    BN: class FakeBN {
      constructor(private v: number) {}
      toString(): string {
        return String(this.v);
      }
    },
  };
});

// Imported AFTER vi.mock so the mocked Anchor is wired in. Vitest hoists
// vi.mock above imports automatically, but writing them after the call
// keeps the order obvious to a reader.
import { Memeputer, MemeputerApiError, keypairSigner } from '../src/index.js';

// Use a deterministic seed so the test signer pubkey is stable across runs.
const CREATOR_KP = Keypair.fromSeed(new Uint8Array(32).fill(7));
const OTHER_KP = Keypair.fromSeed(new Uint8Array(32).fill(9));
const TEST_MINT = new PublicKey('11111111111111111111111111111113');
const OVERRIDE_RECEIVER = new PublicKey('11111111111111111111111111111114');

interface MockConnection {
  getLatestBlockhash: ReturnType<typeof vi.fn>;
  sendTransaction: ReturnType<typeof vi.fn>;
  confirmTransaction: ReturnType<typeof vi.fn>;
}

function buildMockConnection(opts?: { sendThrows?: Error }): MockConnection {
  return {
    getLatestBlockhash: vi.fn(async () => ({
      blockhash: '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi',
      lastValidBlockHeight: 1_000_000,
    })),
    sendTransaction: vi.fn(async () => {
      if (opts?.sendThrows) throw opts.sendThrows;
      return 'FakeSignature1111111111111111111111111111111111111111111111111111111';
    }),
    confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
  };
}

function setup(opts?: {
  creatorWallet?: PublicKey;
  accrued?: bigint;
  claimed?: bigint;
  ledgerThrows?: boolean;
  lastSweptAt?: bigint;
  sendThrows?: Error;
}) {
  mockState.capturedReceiverArg = null;
  mockState.capturedAccountsArg = null;
  if (opts?.ledgerThrows) {
    mockState.feeLedger = new Error('Account does not exist');
  } else {
    mockState.feeLedger = {
      bump: 255,
      mint: TEST_MINT,
      creatorWallet: opts?.creatorWallet ?? CREATOR_KP.publicKey,
      accrued: { toString: () => String(opts?.accrued ?? 1_000_000n) },
      claimed: { toString: () => String(opts?.claimed ?? 0n) },
      lastSweptAt: { toString: () => String(opts?.lastSweptAt ?? 1_747_400_000n) },
      lastClaimAt: { toString: () => '0' },
      reserved: [],
    };
  }
  const conn = buildMockConnection({ sendThrows: opts?.sendThrows });
  const mp = new Memeputer({
    apiUrl: 'http://localhost:3001',
    signer: keypairSigner(CREATOR_KP),
    // Cast: the SDK only touches the three methods we mock; full Connection
    // shape is irrelevant.
    connection: conn as unknown as Connection,
  });
  return { mp, conn };
}

describe('mp.rooms.claimFees', () => {
  beforeEach(() => {
    mockState.capturedReceiverArg = null;
    mockState.capturedAccountsArg = null;
  });

  test('1. happy path — returns ClaimFeesResult with bigint amounts + correct fee math', async () => {
    // 1_000_000 lamports accrued; claim_fee_bps = 100 (1%);
    // expected claimFee = 10_000; netClaimed = 990_000.
    const { mp, conn } = setup({ accrued: 1_000_000n, claimed: 0n });
    const result = await mp.rooms.claimFees(TEST_MINT);
    expect(result.grossClaimed).toBe(1_000_000n);
    expect(result.claimFee).toBe(10_000n);
    expect(result.netClaimed).toBe(990_000n);
    expect(typeof result.txSignature).toBe('string');
    expect(result.txSignature).toMatch(/^FakeSignature/);
    expect(conn.sendTransaction).toHaveBeenCalledTimes(1);
    expect(conn.confirmTransaction).toHaveBeenCalledTimes(1);
  });

  test('2. WRONG_SIGNER — fires BEFORE sendTransaction when signer != ledger.creatorWallet', async () => {
    const { mp, conn } = setup({
      creatorWallet: OTHER_KP.publicKey, // ledger says someone else owns the rewards
      accrued: 1_000_000n,
    });
    await expect(mp.rooms.claimFees(TEST_MINT)).rejects.toMatchObject({
      code: 'WRONG_SIGNER',
      status: 403,
    });
    // The off-chain guard MUST fire before any tx is sent.
    expect(conn.sendTransaction).not.toHaveBeenCalled();
  });

  test('3. LEDGER_NOT_INITIALIZED — Anchor fetch reject wraps as 404 MemeputerApiError', async () => {
    const { mp, conn } = setup({ ledgerThrows: true });
    try {
      await mp.rooms.claimFees(TEST_MINT);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MemeputerApiError);
      expect((err as MemeputerApiError).code).toBe('LEDGER_NOT_INITIALIZED');
      expect((err as MemeputerApiError).status).toBe(404);
      expect((err as MemeputerApiError).details).toMatchObject({
        mint: TEST_MINT.toBase58(),
      });
    }
    expect(conn.sendTransaction).not.toHaveBeenCalled();
  });

  test('4. CLAIM_BELOW_MINIMUM — claimable < MIN_CLAIM_LAMPORTS throws before send', async () => {
    // 50_000 < MIN_CLAIM_LAMPORTS (100_000) → 400 BELOW_MINIMUM.
    const { mp, conn } = setup({ accrued: 50_000n, claimed: 0n });
    await expect(mp.rooms.claimFees(TEST_MINT)).rejects.toMatchObject({
      code: 'CLAIM_BELOW_MINIMUM',
      status: 400,
    });
    expect(conn.sendTransaction).not.toHaveBeenCalled();
  });

  test('5. opts.receiver — recipient arg + accounts.recipient reflect the override', async () => {
    const { mp } = setup({ accrued: 1_000_000n });
    await mp.rooms.claimFees(TEST_MINT, { receiver: OVERRIDE_RECEIVER });
    expect(mockState.capturedReceiverArg?.toBase58()).toBe(
      OVERRIDE_RECEIVER.toBase58(),
    );
    expect(mockState.capturedAccountsArg?.recipient?.toBase58()).toBe(
      OVERRIDE_RECEIVER.toBase58(),
    );
  });

  test('6. RPC_FAILED — sendTransaction reject wraps as MemeputerApiError', async () => {
    const { mp } = setup({
      accrued: 1_000_000n,
      sendThrows: new Error('blockhash not found'),
    });
    await expect(mp.rooms.claimFees(TEST_MINT)).rejects.toMatchObject({
      code: 'RPC_FAILED',
      status: 502,
    });
  });

  test('7. accepts string mint — normalized to PublicKey internally', async () => {
    // Regression guard: the public method signature takes string | PublicKey.
    // The string→PublicKey coercion must not throw for valid base58.
    const { mp } = setup({ accrued: 1_000_000n });
    const result = await mp.rooms.claimFees(TEST_MINT.toBase58());
    expect(result.grossClaimed).toBe(1_000_000n);
  });
});

describe('mp.rooms.feeBalance', () => {
  test('8. happy path — returns FeeBalanceResult with bigint coercion + lastSweptAt Date', async () => {
    const { mp } = setup({
      accrued: 5_000_000n,
      claimed: 2_000_000n,
      lastSweptAt: 1_747_400_000n,
    });
    const balance = await mp.rooms.feeBalance(TEST_MINT);
    expect(balance.accrued).toBe(5_000_000n);
    expect(balance.claimed).toBe(2_000_000n);
    expect(balance.claimable).toBe(3_000_000n);
    expect(balance.lastSweptAt).toBeInstanceOf(Date);
    // 1_747_400_000 seconds = 2025-05-16T13:53:20Z (sanity check, not exact)
    expect(balance.lastSweptAt!.getUTCFullYear()).toBeGreaterThanOrEqual(2025);
  });

  test('9. lastSweptAt=0 returns null sentinel (never-swept ledger)', async () => {
    const { mp } = setup({ accrued: 1_000_000n, lastSweptAt: 0n });
    const balance = await mp.rooms.feeBalance(TEST_MINT);
    expect(balance.lastSweptAt).toBeNull();
  });

  test('10. LEDGER_NOT_INITIALIZED — fetch reject wraps as 404 error', async () => {
    const { mp } = setup({ ledgerThrows: true });
    await expect(mp.rooms.feeBalance(TEST_MINT)).rejects.toMatchObject({
      code: 'LEDGER_NOT_INITIALIZED',
      status: 404,
    });
  });
});

describe('mp.rooms.* setup gates', () => {
  test('11. claimFees throws RPC_FAILED if no connection in ClientOpts', async () => {
    const mp = new Memeputer({
      apiUrl: 'http://localhost:3001',
      signer: keypairSigner(CREATOR_KP),
      // No `connection` field.
    });
    await expect(mp.rooms.claimFees(TEST_MINT)).rejects.toMatchObject({
      code: 'RPC_FAILED',
      status: 500,
    });
  });

  test('12. feeBalance throws RPC_FAILED if no connection in ClientOpts', async () => {
    const mp = new Memeputer({
      apiUrl: 'http://localhost:3001',
      signer: keypairSigner(CREATOR_KP),
    });
    await expect(mp.rooms.feeBalance(TEST_MINT)).rejects.toMatchObject({
      code: 'RPC_FAILED',
      status: 500,
    });
  });
});

// Ensures keypairSigner picks up the new signTransaction method shipped in
// Plan 06.1-06 Task 2. Pure-unit; doesn't need the Anchor mock.
describe('keypairSigner.signTransaction', () => {
  test('13. signs VersionedTransaction in place and returns it', async () => {
    const signer = keypairSigner(CREATOR_KP);
    expect(typeof signer.signTransaction).toBe('function');
    // Construct a minimal VersionedTransaction with a fake message.
    const { TransactionMessage, VersionedTransaction, SystemProgram } = await import(
      '@solana/web3.js'
    );
    const msg = new TransactionMessage({
      payerKey: CREATOR_KP.publicKey,
      recentBlockhash: '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi',
      instructions: [
        SystemProgram.transfer({
          fromPubkey: CREATOR_KP.publicKey,
          toPubkey: OTHER_KP.publicKey,
          lamports: 1,
        }),
      ],
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    const signed = await signer.signTransaction!(tx as unknown as VersionedTransaction);
    // Signature slot 0 should be populated (non-zero bytes)
    expect(signed.signatures[0]!.some((b) => b !== 0)).toBe(true);
  });
});
