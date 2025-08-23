export type PublishOpts = { key?: string; headers?: Record<string, string> };
export type SubOpts = { queue?: string };

export interface Bus {
  publish<T>(subject: string, payload: T, opts?: PublishOpts): Promise<void>;
  subscribe<T>(
    subject: string,
    handler: (msg: T, meta: { subject: string }) => Promise<void> | void,
    opts?: SubOpts,
  ): Promise<() => void>;
  request<TReq, TRes>(subject: string, data: TReq, timeoutMs: number): Promise<TRes>;
  close(): Promise<void>;
}
