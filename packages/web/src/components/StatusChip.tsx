import React from 'react';

interface StatusChipProps {
  status: 'queued' | 'dispatched' | 'running' | 'done' | 'error' | 'canceled';
  className?: string;
}

const statusConfig = {
  queued: { label: 'Queued', className: 'bg-gray-600 text-gray-100' },
  dispatched: { label: 'Dispatched', className: 'bg-yellow-600 text-yellow-100' },
  running: { label: 'Running', className: 'bg-blue-600 text-blue-100' },
  done: { label: 'Done', className: 'bg-green-600 text-green-100' },
  error: { label: 'Error', className: 'bg-red-600 text-red-100' },
  canceled: { label: 'Canceled', className: 'bg-gray-600 text-gray-100' },
};

export function StatusChip({ status, className = '' }: StatusChipProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}
