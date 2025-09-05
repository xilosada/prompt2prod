import type { Provider } from '../evaluator.js';

export type ChecksState = 'success' | 'failure' | 'pending' | 'unknown';
export type ChecksStore = Map<string /*taskId*/, ChecksState>;

/**
 * GitHub checks simulator: store state → success=satisfied, failure=fail, pending/unknown=pending, missing=unsupported
 */
export function createGithubChecksSim(store: ChecksStore): Provider {
  return async ({ taskId, policyRule }) => {
    const require = policyRule.require as 'success' | 'none' | undefined;

    // If require is 'none', always satisfied (useful for tests)
    if (require === 'none') {
      return 'satisfied';
    }

    // If no store entry, return unsupported
    if (!store.has(taskId)) {
      return 'unsupported';
    }

    // Get the checks state for this task
    const checksState = store.get(taskId);

    // If no state in store, return pending
    if (!checksState) {
      return 'pending';
    }

    // Map states to verdicts
    switch (checksState) {
      case 'success':
        return 'satisfied';
      case 'failure':
        return 'fail';
      case 'pending':
      case 'unknown':
      default:
        return 'pending';
    }
  };
}
