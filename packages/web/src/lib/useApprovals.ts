import { useState, useEffect } from 'react';
import { getRunApprovals, type TaskApprovals } from '../api';

export interface UseApprovalsResult {
  approvals: TaskApprovals | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApprovals(runId: string | null): UseApprovalsResult {
  const [approvals, setApprovals] = useState<TaskApprovals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApprovals = async (signal?: AbortSignal) => {
    if (!runId) {
      setApprovals(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getRunApprovals(runId, signal);
      setApprovals(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Failed to fetch approvals');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    fetchApprovals(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [runId]);

  const refetch = () => {
    fetchApprovals();
  };

  return {
    approvals,
    loading,
    error,
    refetch,
  };
}
