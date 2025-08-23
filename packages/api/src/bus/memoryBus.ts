import { EventEmitter } from 'node:events';
import type { Bus } from './Bus.js';

export function createMemoryBus(): Bus {
  const ee = new EventEmitter();

  return {
    async publish<T>(subject: string, payload: T) {
      // microtask to keep async semantics
      queueMicrotask(() => ee.emit(subject, payload));
    },

    async subscribe<T>(
      subject: string,
      handler: (msg: T, meta: { subject: string }) => Promise<void> | void,
    ) {
      // memory driver ignores opts.queue; broadcasts to all subscribers (dev-only).
      const h = (p: T) => void Promise.resolve(handler(p, { subject })).catch(() => {});
      ee.on(subject, h);
      return async () => {
        ee.off(subject, h);
      };
    },

    async request<TReq, TRes>(subject: string, data: TReq, timeoutMs: number) {
      const reply = `${subject}.reply.${Math.random().toString(36).slice(2)}`;
      const result = new Promise<TRes>((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('timeout')), timeoutMs);
        const once = (msg: TRes) => {
          clearTimeout(to);
          ee.off(reply, once);
          resolve(msg);
        };
        ee.on(reply, once);
      });
      ee.emit(subject, { data, reply });
      return result;
    },

    async close() {
      ee.removeAllListeners();
    },
  };
}
