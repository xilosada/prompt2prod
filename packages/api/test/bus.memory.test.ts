import { describe, it, expect } from 'vitest';
import { createMemoryBus } from '../src/bus/memoryBus.js';
import { topics } from '../src/bus/topics.js';

describe('memory bus', () => {
  it('publish/subscribe delivers once', async () => {
    const bus = createMemoryBus();
    const got: string[] = [];
    const unsub = await bus.subscribe<string>('foo', (m) => { got.push(m); });
    await bus.publish('foo', 'bar');
    await new Promise(r => setTimeout(r, 10));
    expect(got).toEqual(['bar']);
    await unsub();
    await bus.close();
  });

  it('topic helper works', () => {
    expect(topics.runLogs('123')).toBe('runs.123.logs');
  });
}); 