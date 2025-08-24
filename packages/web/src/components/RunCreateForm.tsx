import React, { useState } from 'react';
import { createRun, CreateRunRequest } from '../api';
import { addCachedRun } from '../lib/localStore';

interface RunCreateFormProps {
  onRunCreated: (runId: string) => void;
  className?: string;
}

export function RunCreateForm({ onRunCreated, className = '' }: RunCreateFormProps) {
  const [agentId, setAgentId] = useState('demo-agent');
  const [repo, setRepo] = useState('demo/repo');
  const [base, setBase] = useState('main');
  const [prompt, setPrompt] = useState('Hello world');
  const [payload, setPayload] = useState('{\n  "task": "hello world"\n}');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      let parsedPayload: Record<string, unknown> | undefined;
      if (payload.trim()) {
        try {
          parsedPayload = JSON.parse(payload);
        } catch {
          throw new Error('Invalid JSON payload');
        }
      }

      const request: CreateRunRequest = {
        agentId: agentId.trim(),
        repo: repo.trim(),
        base: base.trim(),
        prompt: prompt.trim(),
        payload: parsedPayload,
      };

      const run = await createRun(request);

      // Add to local cache
      addCachedRun({
        id: run.id,
        agentId: run.agentId,
        addedAt: new Date().toISOString(),
      });

      // Select the new run
      onRunCreated(run.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create run');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold">Create Run</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Agent ID</label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="demo-agent"
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Repository</label>
          <input
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="org/repo"
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Base Branch</label>
          <input
            type="text"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="main"
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Prompt</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What would you like the agent to do?"
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Payload (JSON)</label>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder='{"task": "hello world"}'
            rows={4}
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">Optional JSON payload to send to the agent</p>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isCreating || !agentId.trim()}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? 'Creating...' : 'Create Run'}
        </button>
      </form>
    </div>
  );
}
