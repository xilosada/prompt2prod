import { EventEmitter } from 'node:events';
import type { Transport } from '../index.js';

export function createMemoryTransport(): Transport {
  const ee = new EventEmitter();
  ee.setMaxListeners(0);

  return {
    async publish(subject, payload) {
      queueMicrotask(() => ee.emit(subject, payload));
    },
    async subscribe<T>(
      subject: string,
      handler: (m: T) => Promise<void> | void,
      _opts?: { queue?: string }, // eslint-disable-line @typescript-eslint/no-unused-vars
    ) {
      const h = (p: unknown) => {
        void Promise.resolve(handler(p as T)).catch(() => {});
      };
      ee.on(subject, h);
      return async () => ee.off(subject, h);
    },
    async request<TReq, TRes>(subject: string, data: TReq, timeoutMs: number): Promise<TRes> {
      const reply = `${subject}.reply.${Math.random().toString(36).slice(2)}`;
      let once!: (msg: unknown) => void;
      const p = new Promise<TRes>((resolve, reject) => {
        const to = setTimeout(() => {
          ee.off(reply, once);
          reject(new Error('timeout'));
        }, timeoutMs);
        once = (msg) => {
          clearTimeout(to);
          ee.off(reply, once);
          resolve(msg as TRes);
        };
        ee.on(reply, once);
      });
      queueMicrotask(() => ee.emit(subject, { data, reply }));
      return p;
    },
    async close() {
      ee.removeAllListeners();
    },
  };
}
