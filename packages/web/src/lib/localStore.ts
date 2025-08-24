export interface CachedRun {
  id: string;
  agentId?: string;
  addedAt: string;
}

const RUNS_KEY = 'prompt2prod_runs';
const SELECTED_RUN_KEY = 'prompt2prod_selected_run';
const MAX_RUNS = 100;

export function getCachedRuns(): CachedRun[] {
  try {
    const stored = localStorage.getItem(RUNS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addCachedRun(run: CachedRun): void {
  try {
    const runs = getCachedRuns();
    const existingIndex = runs.findIndex((r) => r.id === run.id);

    if (existingIndex >= 0) {
      // Update existing run
      runs[existingIndex] = run;
    } else {
      // Add new run at the beginning
      runs.unshift(run);
      // Keep only the most recent MAX_RUNS
      if (runs.length > MAX_RUNS) {
        runs.splice(MAX_RUNS);
      }
    }

    localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
  } catch {
    // Ignore storage errors
  }
}

export function removeCachedRun(id: string): void {
  try {
    const runs = getCachedRuns();
    const filtered = runs.filter((r) => r.id !== id);
    localStorage.setItem(RUNS_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore storage errors
  }
}

export function getSelectedRunId(): string | null {
  try {
    return localStorage.getItem(SELECTED_RUN_KEY);
  } catch {
    return null;
  }
}

export function setSelectedRunId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(SELECTED_RUN_KEY, id);
    } else {
      localStorage.removeItem(SELECTED_RUN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}
