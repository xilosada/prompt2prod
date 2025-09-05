import type { Provider } from '../evaluator.js';
import { createManualProvider, type ManualStore } from './manual.js';

/**
 * Creates a Coordinator approval provider that is an alias to the manual provider
 * with a fixed approver ID of 'coordinator'.
 */
export function createCoordinatorProvider(store: ManualStore): Provider {
  return async ({ taskId, policyRule }) =>
    createManualProvider(store)({
      taskId,
      policyRule: { ...policyRule, id: 'coordinator' },
    });
}

export type { ManualStore };
