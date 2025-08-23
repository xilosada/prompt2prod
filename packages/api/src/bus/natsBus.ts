import {
  connect,
  StringCodec,
  headers as natsHeaders,
  createInbox,
  type NatsConnection,
  type Subscription,
} from 'nats';
import type { Bus, PublishOpts, SubOpts } from './Bus.js';

type NatsCfg = {
  url: string;
  user?: string;
  pass?: string;
  token?: string;
  name?: string;
};

export async function createNatsBus(cfg: NatsCfg): Promise<Bus> {
  const nc: NatsConnection = await connect({
    servers: cfg.url,
    user: cfg.user,
    pass: cfg.pass,
    token: cfg.token,
    name: cfg.name ?? 'prompt2prod-api',
  });
  const sc = StringCodec();

  function toUint8(payload: unknown, opts?: PublishOpts) {
    const body = sc.encode(JSON.stringify(payload));
    if (!opts?.headers) return { data: body, headers: undefined };
    const h = natsHeaders();
    for (const [k, v] of Object.entries(opts.headers)) h.set(k, String(v));
    return { data: body, headers: h };
  }

  const bus: Bus = {
    async publish(subject, payload, opts) {
      const { data, headers } = toUint8(payload, opts);
      nc.publish(subject, data, headers ? { headers } : undefined);
    },

    async subscribe<T>(
      subject: string,
      handler: (msg: T, meta: { subject: string }) => Promise<void> | void,
      opts?: SubOpts,
    ) {
      const sub: Subscription = nc.subscribe(subject, { queue: opts?.queue });
      (async (): Promise<void> => {
        for await (const m of sub) {
          try {
            const parsed = JSON.parse(sc.decode(m.data)) as T;
            await handler(parsed, { subject: m.subject });
          } catch {
            // best effort; ignore malformed messages
          }
        }
      })().catch(() => {
        // drain errors ignored
      });
      return async () => {
        try {
          sub.unsubscribe();
        } catch {
          // ignore unsubscribe errors
        }
      };
    },

    async request<TReq, TRes>(subject: string, data: TReq, timeoutMs: number): Promise<TRes> {
      // Use a portable pattern: publish { data, reply } to subject, listen on inbox
      const reply = createInbox();
      const p = new Promise<TRes>((resolve, reject) => {
        const sub = nc.subscribe(reply, { max: 1 });
        let done = false;
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          try {
            sub.unsubscribe();
          } catch {
            // ignore unsubscribe errors
          }
          reject(new Error('timeout'));
        }, timeoutMs);

        (async (): Promise<void> => {
          for await (const m of sub) {
            if (done) break;
            done = true;
            clearTimeout(timer);
            try {
              const parsed = JSON.parse(sc.decode(m.data)) as TRes;
              resolve(parsed);
            } catch (e) {
              reject(e as Error);
            }
            break;
          }
        })().catch(() => {
          // ignore
        });
      });

      const { data: body, headers } = toUint8({ data, reply });
      nc.publish(subject, body, headers ? { headers } : undefined);
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

  return bus;
}
