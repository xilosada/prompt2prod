import type { Transport } from '../index.js';

export async function createNatsTransport(
  url: string,
  opts?: { user?: string; pass?: string; token?: string; name?: string },
): Promise<Transport> {
  // Dynamic import to handle optional dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nats: any;
  try {
    nats = await import('nats');
  } catch {
    throw new Error('NATS package not installed. Install with: pnpm add nats');
  }
  const nc = await nats.connect({ servers: url, ...opts });
  const sc = nats.StringCodec();

  return {
    async publish(subject, payload) {
      // TODO: Add metadata headers when needed (e.g., timestamp, source, etc.)
      // Headers are intentionally unused for now to keep the implementation simple
      nc.publish(subject, sc.encode(JSON.stringify(payload)));
    },
    async subscribe(subject, handler, subOpts) {
      const sub = nc.subscribe(subject, { queue: subOpts?.queue });
      (async () => {
        for await (const m of sub) {
          try {
            const parsed = JSON.parse(sc.decode(m.data));
            await handler(parsed);
          } catch {
            // ignore parsing errors
          }
        }
      })().catch(() => {});
      return async () => {
        try {
          sub.unsubscribe();
        } catch {
          // ignore unsubscribe errors
        }
      };
    },
    async request<TReq, TRes>(subject: string, data: TReq, timeoutMs: number): Promise<TRes> {
      const reply = nats.createInbox();
      const p = new Promise<TRes>((resolve, reject) => {
        const sub = nc.subscribe(reply, { max: 1 });
        let done = false;
        const to = setTimeout(() => {
          if (!done) {
            done = true;
            try {
              sub.unsubscribe();
            } catch {
              // ignore unsubscribe errors
            }
            reject(new Error('timeout'));
          }
        }, timeoutMs);
        (async () => {
          for await (const m of sub) {
            if (done) break;
            done = true;
            clearTimeout(to);
            try {
              resolve(JSON.parse(sc.decode(m.data)) as TRes);
            } catch (e) {
              reject(e as Error);
            }
            break;
          }
        })().catch(() => {
          // ignore async errors
        });
      });
      nc.publish(subject, sc.encode(JSON.stringify({ data, reply })));
      return p;
    },
    async close() {
      try {
        await nc.flush();
      } catch {
        // ignore flush errors
      }
      await nc.close();
    },
  };
}
