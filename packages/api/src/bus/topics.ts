export const topics = {
  runLogs: (runId: string) => `runs.${runId}.logs`,
  runPatch: (runId: string) => `runs.${runId}.patch`,
  runStatus: (runId: string) => `runs.${runId}.status`,
  agentWork: (agentId: string) => `agents.${agentId}.work`,
  runControl: (runId: string) => `runs.${runId}.control`,
  agentHeartbeat: (agentId: string) => `agents.${agentId}.heartbeat`,
  // Wildcard topics for composer (memory bus doesn't support these, but we'll handle per-run subscriptions)
  anyRunStatus: () => 'runs.*.status',
  anyRunPatch: () => 'runs.*.patch',
};
