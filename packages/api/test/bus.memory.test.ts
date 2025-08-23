import { describe, it, expect } from 'vitest';
import { createMemoryBus } from '../src/bus/memoryBus.js';
import { topics } from '../src/bus/topics.js';

describe('memory bus', () => {
  it('publish/subscribe delivers once', async () => {
    const bus = createMemoryBus();
    const got: string[] = [];
    const unsub = await bus.subscribe<string>('foo', (m) => {
      got.push(m);
    });
    await bus.publish('foo', 'bar');
    await new Promise((r) => setTimeout(r, 10));
    expect(got).toEqual(['bar']);
    await unsub();
    await bus.close();
  });

  it('topic helper works', () => {
    expect(topics.runLogs('123')).toBe('runs.123.logs');
  });

  it('request/reply round-trip', async () => {
    const bus = createMemoryBus();
    const unsub = await bus.subscribe<{ data: string; reply: string }>('req', ({ data, reply }) => {
      queueMicrotask(() => bus.publish(reply, data.toUpperCase()));
    });
    const res = await bus.request<string, string>('req', 'ok', 200);
    expect(res).toBe('OK');
    await unsub();
    await bus.close();
  });

  it('multi-subscriber broadcast test', async () => {
    const bus = createMemoryBus();
    const got1: string[] = [];
    const got2: string[] = [];

    const unsub1 = await bus.subscribe<string>('broadcast', (m) => {
      got1.push(m);
    });
    const unsub2 = await bus.subscribe<string>('broadcast', (m) => {
      got2.push(m);
    });

    await bus.publish('broadcast', 'message');
    await new Promise((r) => setTimeout(r, 10));

    expect(got1).toEqual(['message']);
    expect(got2).toEqual(['message']);

    await unsub1();
    await unsub2();
    await bus.close();
  });

  it('request timeout handling', async () => {
    const bus = createMemoryBus();
    const unsub = await bus.subscribe<{ data: string; reply: string }>('slow', () => {
      // Don't reply - simulate timeout
    });

    await expect(bus.request<string, string>('slow', 'test', 50)).rejects.toThrow('timeout');

    await unsub();
    await bus.close();
  });

  it('all topic helpers work', () => {
    expect(topics.runLogs('123')).toBe('runs.123.logs');
    expect(topics.runPatch('123')).toBe('runs.123.patch');
    expect(topics.agentWork('agent1')).toBe('agents.agent1.work');
    expect(topics.runControl('123')).toBe('runs.123.control');
    expect(topics.agentHeartbeat('agent1')).toBe('agents.agent1.heartbeat');
  });
});
