/**
 * Approvals API client for @prompt2prod/sdk-agent-node
 *
 * Provides a simple interface to fetch approval status for tasks
 * from the prompt2prod backend API.
 */

// Types matching the API response schema
export interface ApprovalRuleResult {
  provider: string;
  verdict: 'satisfied' | 'pending' | 'fail' | 'unsupported';
}

export interface TaskApprovalsResponse {
  taskId: string;
  strict: boolean;
  aggregate: 'satisfied' | 'pending' | 'fail' | 'error';
  rules: ApprovalRuleResult[];
}

export interface GetApprovalsOptions {
  /** Whether to use strict mode (default: true) */
  strict?: boolean;
  /** Base URL for the API (default: from env or http://localhost:3000) */
  baseUrl?: string;
}

export interface GetApprovalsError {
  error: string;
  details?: Record<string, unknown>;
}

/**
 * Fetches approval status for a task from the prompt2prod backend API.
 *
 * @param taskId - The task ID to get approvals for
 * @param opts - Optional configuration
 * @returns Promise resolving to the approval status
 * @throws {Error} When the request fails or returns an error
 *
 * @example
 * ```typescript
 * import { getApprovals } from '@prompt2prod/sdk-agent-node';
 *
 * const approvals = await getApprovals('task-123', { strict: true });
 * console.log(`Task ${approvals.taskId} status: ${approvals.aggregate}`);
 * ```
 */
export async function getApprovals(
  taskId: string,
  opts: GetApprovalsOptions = {},
): Promise<TaskApprovalsResponse> {
  const { strict = true, baseUrl = getDefaultBaseUrl() } = opts;

  // Validate taskId
  if (!taskId || typeof taskId !== 'string' || taskId.trim().length === 0) {
    throw new Error('taskId must be a non-empty string');
  }

  // Build URL with query parameters
  const url = new URL(`/tasks/${encodeURIComponent(taskId)}/approvals`, baseUrl);
  if (strict !== undefined) {
    url.searchParams.set('strict', strict.toString());
  }

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle HTTP errors
    if (!response.ok) {
      let errorData: GetApprovalsError;
      try {
        errorData = await response.json();
      } catch {
        // If response isn't JSON, create a generic error
        errorData = {
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Map common HTTP status codes to meaningful errors
      switch (response.status) {
        case 404:
          throw new Error(`Task not found: ${taskId}`);
        case 400:
          throw new Error(`Invalid request: ${errorData.error}`);
        case 500:
          throw new Error(`Server error: ${errorData.error}`);
        default:
          throw new Error(`Request failed: ${errorData.error}`);
      }
    }

    // Parse and validate response
    const data = await response.json();

    // Basic validation of response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format: expected object');
    }

    if (typeof data.taskId !== 'string') {
      throw new Error('Invalid response format: missing or invalid taskId');
    }

    if (typeof data.aggregate !== 'string') {
      throw new Error('Invalid response format: missing or invalid aggregate');
    }

    if (!Array.isArray(data.rules)) {
      throw new Error('Invalid response format: missing or invalid rules array');
    }

    return data as TaskApprovalsResponse;
  } catch (error) {
    // Handle fetch errors (network, timeout, etc.)
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: API did not respond within 10 seconds');
      }
      // Re-throw our custom errors
      throw error;
    }

    // Handle unexpected error types
    throw new Error(`Unexpected error: ${String(error)}`);
  }
}

/**
 * Gets the default base URL from environment variables or falls back to localhost
 */
function getDefaultBaseUrl(): string {
  // Check for common environment variables
  const envUrl = process.env.PROMPT2PROD_API_URL || process.env.API_URL || process.env.BASE_URL;

  if (envUrl) {
    return envUrl;
  }

  // Default to localhost for development
  return 'http://localhost:3000';
}
