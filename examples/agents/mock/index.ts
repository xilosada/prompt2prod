import { AgentClient } from '@prompt2prod/sdk-agent-node';

async function main() {
  const agent = new AgentClient({
    agentId: process.env.AGENT_ID ?? 'mock-1',
    transport: (
      await import('@prompt2prod/sdk-agent-node/src/transports/memory.js')
    ).createMemoryTransport(),
  });
  const hb = agent.heartbeat(5000);

  await agent.onWork(async (job) => {
    await agent.publishLog(job.runId, `Starting work on ${job.repo} ${job.base}`);
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
