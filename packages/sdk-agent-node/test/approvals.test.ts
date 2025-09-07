import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getApprovals, type TaskApprovalsResponse } from '../src/approvals.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('getApprovals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.PROMPT2PROD_API_URL;
    delete process.env.API_URL;
    delete process.env.BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch approvals successfully with default options', async () => {
    const mockResponse: TaskApprovalsResponse = {
      taskId: 'test-task-123',
      strict: true,
      aggregate: 'satisfied',
      rules: [
        { provider: 'checks', verdict: 'satisfied' },
        { provider: 'manual', verdict: 'pending' },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await getApprovals('test-task-123');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/tasks/test-task-123/approvals?strict=true',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }),
    );
  });

  it('should fetch approvals with custom options', async () => {
    const mockResponse: TaskApprovalsResponse = {
      taskId: 'test-task-456',
      strict: false,
      aggregate: 'pending',
      rules: [{ provider: 'manual', verdict: 'pending' }],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await getApprovals('test-task-456', {
      strict: false,
      baseUrl: 'https://api.example.com',
    });

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/tasks/test-task-456/approvals?strict=false',
      expect.any(Object),
    );
  });

  it('should use environment variable for base URL', async () => {
    process.env.PROMPT2PROD_API_URL = 'https://prod.api.com';

    const mockResponse: TaskApprovalsResponse = {
      taskId: 'test-task-789',
      strict: true,
      aggregate: 'satisfied',
      rules: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    await getApprovals('test-task-789');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://prod.api.com/tasks/test-task-789/approvals?strict=true',
      expect.any(Object),
    );
  });

  it('should handle 404 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Task not found' }),
    });

    await expect(getApprovals('nonexistent-task')).rejects.toThrow(
      'Task not found: nonexistent-task',
    );
  });

  it('should handle 400 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid request' }),
    });

    await expect(getApprovals('invalid-task')).rejects.toThrow('Invalid request: Invalid request');
  });

  it('should handle 500 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    await expect(getApprovals('test-task')).rejects.toThrow('Server error: Internal server error');
  });

  it('should handle network timeout', async () => {
    // Mock AbortController to simulate timeout
    const mockAbortController = {
      abort: vi.fn(),
      signal: { aborted: false },
    };

    // Mock AbortController constructor
    global.AbortController = vi.fn(() => mockAbortController) as unknown as typeof AbortController;

    // Mock setTimeout to immediately trigger abort
    vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      callback();
      return 123 as unknown as NodeJS.Timeout;
    });

    mockFetch.mockImplementationOnce(() => {
      const error = new Error('Request timeout');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    await expect(getApprovals('test-task')).rejects.toThrow(
      'Request timeout: API did not respond within 10 seconds',
    );
  });

  it('should validate taskId parameter', async () => {
    await expect(getApprovals('')).rejects.toThrow('taskId must be a non-empty string');
    await expect(getApprovals('   ')).rejects.toThrow('taskId must be a non-empty string');
    await expect(getApprovals(null as unknown as string)).rejects.toThrow(
      'taskId must be a non-empty string',
    );
    await expect(getApprovals(undefined as unknown as string)).rejects.toThrow(
      'taskId must be a non-empty string',
    );
  });

  it('should handle invalid JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => 'invalid json',
    });

    await expect(getApprovals('test-task')).rejects.toThrow();
  });

  it('should handle malformed response structure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ invalid: 'structure' }),
    });

    await expect(getApprovals('test-task')).rejects.toThrow(
      'Invalid response format: missing or invalid taskId',
    );
  });

  it('should handle non-JSON error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('Not JSON');
      },
    });

    await expect(getApprovals('test-task')).rejects.toThrow(
      'Server error: HTTP 500: Internal Server Error',
    );
  });
});
