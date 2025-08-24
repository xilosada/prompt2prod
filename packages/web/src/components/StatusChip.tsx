import React from 'react';
import type { AgentStatus } from '../api';

interface StatusChipProps {
  status: 'queued' | 'dispatched' | 'running' | 'done' | 'error' | 'canceled' | AgentStatus;
  className?: string;
}

const runStatusConfig = {
  queued: { label: 'Queued', className: 'bg-gray-600 text-gray-100', title: 'run is queued' },
  dispatched: {
    label: 'Dispatched',
    className: 'bg-yellow-600 text-yellow-100',
    title: 'run is dispatched',
  },
  running: { label: 'Running', className: 'bg-blue-600 text-blue-100', title: 'run is running' },
  done: { label: 'Done', className: 'bg-green-600 text-green-100', title: 'run is done' },
  error: { label: 'Error', className: 'bg-red-600 text-red-100', title: 'run has error' },
  canceled: { label: 'Canceled', className: 'bg-gray-600 text-gray-100', title: 'run is canceled' },
};

const agentStatusConfig = {
  online: {
    label: 'Online',
    className: 'bg-emerald-600 text-emerald-100',
    title: 'agent is online',
  },
  stale: { label: 'Stale', className: 'bg-amber-600 text-amber-100', title: 'agent is stale' },
  offline: { label: 'Offline', className: 'bg-gray-600 text-gray-100', title: 'agent is offline' },
};

export function StatusChip({ status, className = '' }: StatusChipProps) {
  const config =
    runStatusConfig[status as keyof typeof runStatusConfig] ||
    agentStatusConfig[status as keyof typeof agentStatusConfig];

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.className} ${className}`}
      title={config.title}
    >
      {config.label}
    </span>
  );
}
