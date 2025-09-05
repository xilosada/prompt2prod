import {
  AgentClient,
  createMemoryTransport,
  getApprovals,
} from '../../../packages/sdk-agent-node/dist/index.js';

async function main() {
  const agent = new AgentClient({
    agentId: process.env.AGENT_ID ?? 'mock-1',
    transport: createMemoryTransport(),
  });
  const hb = agent.heartbeat(5000);

  await agent.onWork(async (job) => {
    await agent.publishLog(job.runId, `Starting work on ${job.repo} ${job.base}`);

    // Example: Check approvals for the task (if taskId is available in payload)
    if (job.payload && typeof job.payload === 'object' && 'taskId' in job.payload) {
      try {
        const approvals = await getApprovals(job.payload.taskId as string, { strict: true });
        await agent.publishLog(
          job.runId,
          `Task approvals: ${approvals.aggregate} (${approvals.rules.length} rules)`,
        );
      } catch (error) {
        await agent.publishLog(job.runId, `Failed to fetch approvals: ${(error as Error).message}`);
      }
    }

    // pretend to do a change
    await agent.publishPatch(job.runId, {
      files: [{ path: 'README.generated.md', content: `# Generated for ${job.runId}` }],
    });
    await agent.publishLog(job.runId, `Patch submitted`);
  });

  process.on('SIGINT', async () => {
    hb.stop();
    await agent.close();
    process.exit(0);
  });
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
