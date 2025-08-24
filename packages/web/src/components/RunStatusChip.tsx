import React from 'react';
import type { RunStatus } from '../api';

export function RunStatusChip({
  status,
  ...rest
}: { status: RunStatus } & React.HTMLAttributes<HTMLSpanElement>) {
  const cls =
    {
      queued: 'bg-gray-200 text-gray-800',
      running: 'bg-blue-200 text-blue-800',
      done: 'bg-green-200 text-green-800',
      error: 'bg-red-200 text-red-800',
      canceled: 'bg-amber-200 text-amber-800',
    }[status] ?? 'bg-gray-200 text-gray-800';
  return (
    <span
      data-testid="run-status-chip"
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}
      {...rest}
      title={`run is ${status}`}
    >
      {status}
    </span>
  );
}
