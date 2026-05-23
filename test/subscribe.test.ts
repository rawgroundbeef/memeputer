import { describe, test, expect, vi, beforeEach } from 'vitest';

/**
 * mp.rooms.subscribe wiring tests (Plan 06-02 Task 2).
 *
 * Verifies the Socket.IO wiring via vi.mock of `socket.io-client`:
 *  - opens io(wsBase, { path: '/ws', transports: ['websocket'], reconnection: true })
 *  - emits 'subscribe' with the mint on the 'connect' callback
 *  - invokes the user callback when 'message' fires
 *  - the returned unsub function calls socket.disconnect()
 *
 * The mock returns a socket object whose `on` recorder lets the test
 * synthesize the connect/message events without a real Socket.IO server.
 */

const emitSpy = vi.fn();
const onMap = new Map<string, (arg: unknown) => void>();
const onSpy = vi.fn((evt: string, cb: (arg: unknown) => void) => {
  onMap.set(evt, cb);
});
const disconnectSpy = vi.fn();
const ioMock = vi.fn(() => ({ on: onSpy, emit: emitSpy, disconnect: disconnectSpy }));

vi.mock('socket.io-client', () => ({ io: ioMock, default: { io: ioMock } }));

beforeEach(() => {
  emitSpy.mockClear();
  onSpy.mockClear();
  disconnectSpy.mockClear();
  onMap.clear();
  ioMock.mockClear();
});

describe('mp.rooms.subscribe wiring', () => {
  test('opens socket.io-client with path /ws, transports: [websocket]; emits subscribe on connect; routes message events to cb; unsub disconnects', async () => {
    // Dynamic import keeps vi.mock active at the right hoist point.
    const { Memeputer, keypairSigner } = await import('../src/index.js');
    const { Keypair } = await import('@solana/web3.js');
    const mp = new Memeputer({
      signer: keypairSigner(Keypair.fromSeed(new Uint8Array(32).fill(80))),
      apiUrl: 'http://localhost:3001',
    });
    const received: unknown[] = [];
    const unsub = mp.rooms.subscribe('MintX', (e) => received.push(e));

    // Wait for the dynamic import inside subscribe() to resolve.
    await new Promise((r) => setTimeout(r, 25));

    expect(ioMock).toHaveBeenCalledTimes(1);
    // First argument: wsBase derived by replacing http→ws (T-06-01-01 schema).
    expect(ioMock.mock.calls[0]![0]).toBe('ws://localhost:3001');
    expect(ioMock.mock.calls[0]![1]).toMatchObject({
      path: '/ws',
      transports: ['websocket'],
      reconnection: true,
    });

    // Simulate 'connect' → SDK should emit subscribe.
    const connectCb = onMap.get('connect');
    expect(connectCb).toBeDefined();
    connectCb!(undefined);
    expect(emitSpy).toHaveBeenCalledWith('subscribe', { mint: 'MintX' });

    // Simulate 'message' → cb invoked.
    const evt = {
      room_mint: 'MintX',
      message_id: '01ABC',
      agent_wallet: 'W',
      body: 'gm',
      parent_message_id: null,
      created_at: '2026-05-17T00:00:00Z',
    };
    const msgCb = onMap.get('message');
    expect(msgCb).toBeDefined();
    msgCb!(evt);
    expect(received[0]).toEqual(evt);

    // Unsub disconnects.
    unsub();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  // WR-10: subscribe_rejected from the server (e.g. ROOM_AT_CAPACITY) must
  // surface as a MemeputerApiError rather than be silently swallowed.
  test('subscribe_rejected event surfaces a MemeputerApiError via queueMicrotask', async () => {
    const { Memeputer, keypairSigner, MemeputerApiError } = await import(
      '../src/index.js'
    );
    const { Keypair } = await import('@solana/web3.js');
    const mp = new Memeputer({
      signer: keypairSigner(Keypair.fromSeed(new Uint8Array(32).fill(81))),
      apiUrl: 'http://localhost:3001',
    });
    mp.rooms.subscribe('MintX', () => {});
    await new Promise((r) => setTimeout(r, 25));

    const rejectedCb = onMap.get('subscribe_rejected');
    expect(rejectedCb).toBeDefined();

    // Capture the queueMicrotask throw without crashing the test.
    let captured: unknown;
    const originalHandler = process.listeners('uncaughtException').slice();
    process.removeAllListeners('uncaughtException');
    process.once('uncaughtException', (err) => {
      captured = err;
    });
    rejectedCb!({ code: 'ROOM_AT_CAPACITY', message: 'room is full', status: 503 });
    await new Promise((r) => setTimeout(r, 5));
    // Restore prior handlers.
    for (const h of originalHandler) process.on('uncaughtException', h);

    expect(captured).toBeInstanceOf(MemeputerApiError);
    expect((captured as InstanceType<typeof MemeputerApiError>).code).toBe(
      'ROOM_AT_CAPACITY',
    );
  });
});
