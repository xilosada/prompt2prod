import { describe, it, expect } from 'vitest';
import { createMemoryBus } from '../src/bus/memoryBus.js';
import { topics } from '../src/bus/topics.js';

describe('memory bus', () => {
  it('publish/subscribe delivers', async () => {
    const bus = createMemoryBus();
    const got: string[] = [];
    const unsub = await bus.subscribe<string>('foo', (m) => {
      got.push(m);
    });
    await bus.publish('foo', 'bar');
    await new Promise((r) => setTimeout(r, 5));
    expect(got).toEqual(['bar']);
    await unsub();
    await bus.close();
  });

  it('broadcast semantics: two subscribers both receive', async () => {
    const bus = createMemoryBus();
    const a: string[] = [],
      b: string[] = [];
    const ua = await bus.subscribe<string>('x', (m) => {
      a.push(m);
    });
    const ub = await bus.subscribe<string>('x', (m) => {
      b.push(m);
    });
    await bus.publish('x', 'm1');
    await new Promise((r) => setTimeout(r, 5));
    expect(a).toEqual(['m1']);
    expect(b).toEqual(['m1']);
    await ua();
    await ub();
    await bus.close();
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

  it('topics helper shapes', () => {
    expect(topics.runLogs('123')).toBe('runs.123.logs');
    expect(topics.runPatch('123')).toBe('runs.123.patch');
    expect(topics.agentWork('a')).toBe('agents.a.work');
  });
});
