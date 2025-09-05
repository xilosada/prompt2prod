import type { Provider } from '../evaluator.js';

export type ManualStore = Map<string /*taskId*/, Set<string /*approverId*/>>;

/**
 * Creates a manual approval provider that uses an in-memory store
 * to track which approvers have approved which tasks.
 *
 * Provider behavior:
 * - Read `rule.id` as the required approver (string)
 * - **satisfied** if `store` has `taskId` and includes `rule.id`
 * - **pending** if not present
 * - **unsupported** if `rule.id` is not a non-empty string
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
