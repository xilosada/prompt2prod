import { createMemoryTransport } from './transports/memory.js';

// Topics (SDK-local, keep shapes identical to API)
const topics = {
  agentWork: (agentId: string) => `agents.${agentId}.work`,
  runLogs: (runId: string) => `runs.${runId}.logs`,
  runPatch: (runId: string) => `runs.${runId}.patch`,
  runControl: (runId: string) => `runs.${runId}.control`,
  agentHeartbeat: (agentId: string) => `agents.${agentId}.heartbeat`,
};

// Transport interface (internal to SDK)
type Handler<T> = (msg: T) => Promise<void> | void;

interface Transport {
  publish<T>(subject: string, payload: T): Promise<void>;
  subscribe<T>(
    subject: string,
    handler: Handler<T>,
    opts?: { queue?: string },
  ): Promise<() => void>;
  request<TReq, TRes>(subject: string, data: TReq, timeoutMs: number): Promise<TRes>;
  close(): Promise<void>;
}

export type AgentClientOptions = {
  agentId: string;
  transport?: Transport; // default resolved from env
};

export type WorkItem = {
  runId: string;
  repo: string;
  base: string;
  prompt: string;
  payload?: unknown;
};

export class AgentClient {
  private t: Transport;
  private id: string;

  constructor(opts: AgentClientOptions) {
    this.id = opts.agentId;
    this.t = opts.transport ?? createMemoryTransport();
  }

  async onWork(handler: (job: WorkItem) => Promise<void>) {
    return this.t.subscribe<WorkItem>(topics.agentWork(this.id), handler, { queue: this.id });
  }

  async publishLog(runId: string, line: string) {
    await this.t.publish<string>(topics.runLogs(runId), line);
  }

  async publishPatch(runId: string, patch: { files: Array<{ path: string; content: string }> }) {
    await this.t.publish(topics.runPatch(runId), patch);
  }

  async onControl(
    runId: string,
    handler: (msg: { action: 'cancel' | 'pause' | 'resume' }) => Promise<void>,
  ) {
    return this.t.subscribe(topics.runControl(runId), handler);
  }

  heartbeat(intervalMs = 10000) {
    const tick = async () => {
      await this.t.publish(topics.agentHeartbeat(this.id), { at: Date.now() }).catch(() => {});
    };
    const timer = setInterval(tick, intervalMs);
    return { stop: () => clearInterval(timer) };
  }

  async close() {
    await this.t.close();
  }
}

// Export transport types for external use
export type { Transport };
export { topics };

// Re-export transport factories for convenience
export { createMemoryTransport } from './transports/memory.js';
export { createNatsTransport } from './transports/nats.js';
