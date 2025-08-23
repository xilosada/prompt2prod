export const topics = {
  runLogs: (runId: string) => `runs.${runId}.logs`,
  runPatch: (runId: string) => `runs.${runId}.patch`,
  runStatus: (runId: string) => `runs.${runId}.status`,
  agentWork: (agentId: string) => `agents.${agentId}.work`,
  runControl: (runId: string) => `runs.${runId}.control`,
  agentHeartbeat: (agentId: string) => `agents.${agentId}.heartbeat`,
};
