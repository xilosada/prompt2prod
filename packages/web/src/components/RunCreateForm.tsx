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
  const [jsonError, setJsonError] = useState<string | null>(null);

  const validateJson = (jsonString: string): boolean => {
    if (!jsonString.trim()) return true;
    try {
      JSON.parse(jsonString);
      setJsonError(null);
      return true;
    } catch (err) {
      setJsonError('Invalid JSON format');
      return false;
    }
  };

  const handlePayloadChange = (value: string) => {
    setPayload(value);
    validateJson(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all required fields
    const trimmedAgentId = agentId.trim();
    const trimmedRepo = repo.trim();
    const trimmedBase = base.trim();
    const trimmedPrompt = prompt.trim();

    if (!trimmedAgentId || !trimmedRepo || !trimmedBase || !trimmedPrompt) {
      setError('All fields are required');
      return;
    }

    // Validate JSON payload
    if (!validateJson(payload)) {
      setError('Please fix the JSON payload error');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      let parsedPayload: Record<string, unknown> | undefined;
      if (payload.trim()) {
        parsedPayload = JSON.parse(payload);
      }

      const request: CreateRunRequest = {
        agentId: trimmedAgentId,
        repo: trimmedRepo,
        base: trimmedBase,
        prompt: trimmedPrompt,
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
            onChange={(e) => handlePayloadChange(e.target.value)}
            placeholder='{"task": "hello world"}'
            rows={4}
            className={`w-full rounded-lg bg-slate-900 border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm ${
              jsonError ? 'border-red-500' : 'border-slate-700'
            }`}
          />
          <p className="text-xs text-slate-400 mt-1">Optional JSON payload to send to the agent</p>
          {jsonError && <p className="text-xs text-red-400 mt-1">{jsonError}</p>}
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={
            isCreating ||
            !agentId.trim() ||
            !repo.trim() ||
            !base.trim() ||
            !prompt.trim() ||
            !!jsonError
          }
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? 'Creating...' : 'Create Run'}
        </button>
      </form>
    </div>
  );
}
