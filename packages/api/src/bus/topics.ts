export const topics = {
  runLogs: (runId: string) => `runs.${runId}.logs`,
  // reserved for future PRs:
  runPatch: (runId: string) => `runs.${runId}.patch`,
  agentWork: (agentId: string) => `agents.${agentId}.work`,
  runControl: (runId: string) => `runs.${runId}.control`,
  agentHeartbeat: (agentId: string) => `agents.${agentId}.heartbeat`,
}; 