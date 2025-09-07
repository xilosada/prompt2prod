import React from 'react';
import { useApprovals } from '../lib/useApprovals';
import type { ApprovalAggregate, ApprovalVerdict } from '../api';

interface ApprovalsCardProps {
  runId: string;
  className?: string;
}

function ApprovalBadge({ aggregate }: { aggregate: ApprovalAggregate }) {
  const getBadgeStyles = (status: ApprovalAggregate) => {
    switch (status) {
      case 'satisfied':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'fail':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'error':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAriaLabel = (status: ApprovalAggregate) => {
    switch (status) {
      case 'satisfied':
        return 'All approvals satisfied';
      case 'pending':
        return 'Approvals pending';
      case 'fail':
        return 'Approvals failed';
      case 'error':
        return 'Approval error';
      default:
        return 'Unknown approval status';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeStyles(aggregate)}`}
      aria-label={getAriaLabel(aggregate)}
    >
      {aggregate}
    </span>
  );
}

function RuleVerdict({ verdict }: { verdict: ApprovalVerdict }) {
  const getVerdictStyles = (verdict: ApprovalVerdict) => {
    switch (verdict) {
      case 'satisfied':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'fail':
        return 'text-red-600';
      case 'unsupported':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  return <span className={`text-sm font-medium ${getVerdictStyles(verdict)}`}>{verdict}</span>;
}

export function ApprovalsCard({ runId, className = '' }: ApprovalsCardProps) {
  const { approvals, loading, error } = useApprovals(runId);

  if (loading) {
    return (
      <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">Approvals</h3>
        </div>
        <div className="text-sm text-slate-400">Loading approvals...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">Approvals</h3>
        </div>
        <div className="text-sm text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!approvals) {
    return (
      <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">Approvals</h3>
        </div>
        <div className="text-sm text-slate-400">No approvals data available</div>
      </div>
    );
  }

  return (
    <div
      className={`bg-slate-900/50 border border-slate-800 rounded-xl p-4 ${className}`}
      role="region"
      aria-label="Task approvals status"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Approvals</h3>
        <ApprovalBadge aggregate={approvals.aggregate} />
      </div>

      {approvals.rules.length > 0 ? (
        <div className="space-y-2">
          {approvals.rules.map((rule, index) => (
            <div
              key={`${rule.provider}-${index}`}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-slate-300">{rule.provider}</span>
              <RuleVerdict verdict={rule.verdict} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-400">No approval rules configured</div>
      )}

      {approvals.strict && (
        <div className="mt-3 pt-2 border-t border-slate-700">
          <div className="text-xs text-slate-500">Mode: All rules must be satisfied</div>
        </div>
      )}
    </div>
  );
}
