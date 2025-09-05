import type { Provider } from '../evaluator.js';
import { createManualProvider, type ManualStore } from './manual.js';

/**
 * Coordinator approval provider: always uses 'coordinator' as approver → satisfied if 'coordinator' in store, pending otherwise
 */
export function createCoordinatorProvider(store: ManualStore): Provider {
  return async ({ taskId, policyRule }) =>
    createManualProvider(store)({
      taskId,
      policyRule: { ...policyRule, id: 'coordinator' },
    });
}

export type { ManualStore };
