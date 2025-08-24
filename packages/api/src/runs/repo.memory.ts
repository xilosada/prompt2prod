export type RunStatus = 'queued' | 'dispatched' | 'running' | 'done' | 'error' | 'canceled';

export type RunRecord = {
  id: string;
  agentId: string;
  repo: string;
  base: string;
  prompt: string;
  payload?: unknown;
  status: RunStatus;
  createdAt: number;
  updatedAt: number;
  pr?: {
    branch: string;
    url?: string;
    number?: number;
  };
  composeError?: string;
};

export interface RunsRepo {
  create(
    r: Omit<RunRecord, 'createdAt' | 'updatedAt' | 'status'> & Partial<Pick<RunRecord, 'status'>>,
  ): RunRecord;
  get(id: string): RunRecord | undefined;
  setStatus(id: string, status: RunStatus): RunRecord | undefined;
  update(id: string, updater: (run: RunRecord) => Partial<RunRecord>): RunRecord | undefined;
}

export function createMemoryRunsRepo(): RunsRepo {
  const map = new Map<string, RunRecord>();
  return {
    create(r) {
      const now = Date.now();
      const rec: RunRecord = {
        status: 'queued',
        createdAt: now,
        updatedAt: now,
        ...r,
      } as RunRecord;
      map.set(rec.id, rec);
      return rec;
    },
    get(id) {
      return map.get(id);
    },
    setStatus(id, status) {
      const cur = map.get(id);
      if (!cur) return undefined;
      const next = { ...cur, status, updatedAt: Date.now() };
      map.set(id, next);
      return next;
    },
    update(id, updater) {
      const cur = map.get(id);
      if (!cur) return undefined;
      const updates = updater(cur);
      const next = { ...cur, ...updates, updatedAt: Date.now() };
      map.set(id, next);
      return next;
    },
  };
}
