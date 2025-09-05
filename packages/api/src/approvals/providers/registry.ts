import type { ProviderRegistry } from '../evaluator.js';
import { createManualProvider, type ManualStore } from './manual.js';
import { createQaProvider } from './qa.js';
import { createCoordinatorProvider } from './coordinator.js';
import { createGithubChecksSim, type ChecksStore } from './github-checks.sim.js';

export type ProviderStores = {
  manual: ManualStore;
  checks: ChecksStore;
};

/**
 * Creates a default provider registry with all stub providers.
 * Accepts in-memory stores so tests can control them directly.
 *
 * This registry includes:
 * - manual: Generic manual approval provider
 * - qa: QA approval provider (alias to manual with id='qa')
 * - coordinator: Coordinator approval provider (alias to manual with id='coordinator')
 * - github.checks: GitHub checks simulator
 */
export function createDefaultProviderRegistry(stores: ProviderStores): ProviderRegistry {
  // Create adapter functions to convert between old and new provider interfaces
  const adaptProvider =
    (oldProvider: import('../evaluator.js').Provider) =>
    async ({ rule, task }: { rule: Record<string, unknown>; task: { id: string } }) => {
      const result = await oldProvider({
        taskId: task.id,
        policyRule: rule as import('@prompt2prod/shared').ApprovalRule,
      });
      // Convert legacy verdict format to new format
      return result === 'satisfied' ? 'pass' : result;
    };

  return {
    manual: adaptProvider(createManualProvider(stores.manual)),
    qa: adaptProvider(createQaProvider(stores.manual)),
    coordinator: adaptProvider(createCoordinatorProvider(stores.manual)),
    'github.checks': adaptProvider(createGithubChecksSim(stores.checks)),
  };
}
