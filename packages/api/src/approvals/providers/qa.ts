import type { Provider } from '../evaluator.js';
import { createManualProvider, type ManualStore } from './manual.js';

/**
 * Creates a QA approval provider that is an alias to the manual provider
 * with a fixed approver ID of 'qa'.
 */
export function createQaProvider(store: ManualStore): Provider {
  return async ({ taskId, policyRule }) =>
    createManualProvider(store)({
      taskId,
      policyRule: { ...policyRule, id: 'qa' },
    });
}

export type { ManualStore };
