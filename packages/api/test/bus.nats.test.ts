import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createNatsBus } from '../src/bus/natsBus.js';
import { topics } from '../src/bus/topics.js';

let bus: Awaited<ReturnType<typeof createNatsBus>>;

const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';

// Skip tests if NATS is not available
const describeNats = process.env.BUS_DRIVER === 'nats' ? describe : describe.skip;

describeNats('nats bus (smoke)', () => {
  beforeAll(async () => {
    try {
      bus = await createNatsBus({ url: NATS_URL, name: 'p2p-test' });
    } catch (error) {
      console.error('Failed to connect to NATS:', error);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    if (bus) {
      await bus.close();
    }
  });

  it('publish/subscribe delivers', async () => {
    const got: string[] = [];
    const unsub = await bus.subscribe<string>('foo', (m) => {
      got.push(m);
    });
    await bus.publish('foo', 'bar');
    await new Promise((r) => setTimeout(r, 10));
    expect(got).toEqual(['bar']);
    await unsub();
  });

  it('request/reply round-trip', async () => {
    const subUnsub = await bus.subscribe<{ data: string; reply: string }>(
      'req',
      async ({ data, reply }) => {
        await bus.publish(reply, data.toUpperCase());
      },
    );
    const res = await bus.request<string, string>('req', 'ok', 500);
    expect(res).toBe('OK');
    await subUnsub();
  });

  it('topics helper shape (sanity)', () => {
    expect(topics.runLogs('123')).toBe('runs.123.logs');
  });
});
