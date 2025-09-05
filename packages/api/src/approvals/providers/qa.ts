import type { Provider } from '../evaluator.js';
import { createManualProvider, type ManualStore } from './manual.js';

/**
 * QA approval provider: always uses 'qa' as approver → satisfied if 'qa' in store, pending otherwise
 */
export function createQaProvider(store: ManualStore): Provider {
  return async ({ taskId, policyRule }) =>
    createManualProvider(store)({
      taskId,
      policyRule: { ...policyRule, id: 'qa' },
    });
}

export type { ManualStore };
