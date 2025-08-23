import { AgentClient } from '../../../packages/sdk-agent-node/dist/index.js';
import { createMemoryTransport } from '../../../packages/sdk-agent-node/dist/transports/memory.js';

async function main() {
  const agent = new AgentClient({
    agentId: process.env.AGENT_ID ?? 'mock-1',
    transport: createMemoryTransport(),
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
