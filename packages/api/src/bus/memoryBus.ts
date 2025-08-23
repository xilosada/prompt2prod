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

    async subscribe<T>(
      subject: string,
      handler: (msg: T, meta: { subject: string }) => Promise<void> | void,
    ) {
      // memory driver ignores opts.queue; broadcasts to all subscribers (dev-only)
      const h = (p: unknown) => {
        void Promise.resolve(handler(p as T, { subject })).catch(() => {});
      };
      ee.on(subject, h);
      return async () => {
        ee.off(subject, h);
      };
    },

    async request<TReq, TRes>(subject: string, data: TReq, timeoutMs: number): Promise<TRes> {
      const reply = `${subject}.reply.${Math.random().toString(36).slice(2)}`;
      let once!: (msg: unknown) => void;
      const p = new Promise<TRes>((resolve, reject) => {
        const to = setTimeout(() => {
          ee.off(reply, once);
          reject(new Error('timeout'));
        }, timeoutMs);
        once = (msg: unknown) => {
          clearTimeout(to);
          ee.off(reply, once);
          resolve(msg as TRes);
        };
        ee.on(reply, once);
      });
      ee.emit(subject, { data, reply });
      return p;
    },

    async close() {
      ee.removeAllListeners();
    },
  };
}
