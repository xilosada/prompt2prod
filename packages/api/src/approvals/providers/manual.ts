import type { Provider } from '../evaluator.js';

export type ManualStore = Map<string /*taskId*/, Set<string /*approverId*/>>;

/**
 * Manual approval provider: rule.id (string) → satisfied if in store, pending if missing, unsupported if invalid
 */
export function createManualProvider(store: ManualStore): Provider {
  return async ({ taskId, policyRule }) => {
    const approverId = policyRule.id;

    // Check if rule.id is a valid non-empty string
    if (typeof approverId !== 'string' || approverId.trim() === '') {
      return 'unsupported';
    }

    // Check if task has been approved by this approver
    const taskApprovers = store.get(taskId);
    if (taskApprovers && taskApprovers.has(approverId)) {
      return 'satisfied';
    }

    return 'pending';
  };
}
