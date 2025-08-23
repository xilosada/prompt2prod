import { EventEmitter } from 'node:events';
import type { Bus } from './Bus.js';

export function createMemoryBus(): Bus {
  const ee = new EventEmitter();
  ee.setMaxListeners(0); // dev-friendly

  return {
    async publish(subject, payload) {
      // async semantics; avoid sync re-entrancy
      queueMicrotask(() => ee.emit(subject, payload));
    },

    async subscribe(subject, handler) {
      // memory driver ignores opts.queue; broadcasts to all subscribers (dev-only)
      const h = (p: unknown) => {
        void Promise.resolve(handler(p as never, { subject })).catch(() => {});
      };
      ee.on(subject, h);
      return async () => {
        ee.off(subject, h);
      };
    },

    async request(subject, data, timeoutMs) {
      const reply = `${subject}.reply.${Math.random().toString(36).slice(2)}`;
      const result = new Promise<unknown>((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('timeout')), timeoutMs);
        const once = (msg: unknown) => {
          clearTimeout(to);
          ee.off(reply, once);
          resolve(msg);
        };
        ee.on(reply, once);
      });
      ee.emit(subject, { data, reply });
      return result as Promise<never>;
    },

    async close() {
      ee.removeAllListeners();
    },
  };
}
