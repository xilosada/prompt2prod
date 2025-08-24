import React, { useCallback, useEffect, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

export function App() {
  const [runId, setRunId] = useState('demo');
  const [connected, setConnected] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (connected || !runId.trim()) return;
    const url = `${API_BASE}/runs/${encodeURIComponent(runId.trim())}/logs/stream`;
    const es = new EventSource(url, { withCredentials: false });
    es.onopen = () => setConnected(true);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        setLines((prev) => [...prev, String(data)]);
      } catch {
        setLines((prev) => [...prev, ev.data]);
      }
    };
    es.onerror = () => {
      es.close();
      setConnected(false);
    };
    esRef.current = es;
  }, [connected, runId]);

  const disconnect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => () => esRef.current?.close(), []);

  const clear = () => setLines([]);

  const emitTest = async () => {
    const id = runId.trim();
    if (!id) return;
    await fetch(`${API_BASE}/runs/${encodeURIComponent(id)}/logs/test`, {
      method: 'POST',
    });
  };

  return (
    <div className="min-h-dvh p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">prompt2prod — Runs Monitor</h1>
        <p className="text-sm text-slate-400">
          SSE demo: stream logs from{' '}
          <code className="px-1 rounded bg-slate-800">/runs/:id/logs/stream</code>
        </p>
      </header>

      <div className="flex flex-col gap-3 max-w-xl">
        <label className="text-sm font-medium">Run ID</label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="demo"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
          />
          {!connected ? (
            <button
              onClick={connect}
              className="rounded-lg bg-indigo-600 px-4 py-2 hover:bg-indigo-500"
            >
              Connect
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="rounded-lg bg-rose-600 px-4 py-2 hover:bg-rose-500"
            >
              Disconnect
            </button>
          )}
          <button
            onClick={clear}
            className="rounded-lg bg-slate-800 px-3 py-2 border border-slate-700"
          >
            Clear
          </button>
          <button
            onClick={emitTest}
            className="rounded-lg bg-emerald-600 px-3 py-2 hover:bg-emerald-500"
            title="POST /runs/:id/logs/test"
          >
            Emit test
          </button>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-sm text-slate-400 mb-2">
          {connected ? 'Connected' : 'Disconnected'} • API: {API_BASE}
        </div>
        <pre className="rounded-xl bg-black/40 border border-slate-800 p-4 max-h-[60dvh] overflow-auto text-sm leading-6">
          {lines.map((l, i) => (
            <span key={i}>{l}\n</span>
          ))}
        </pre>
      </div>
    </div>
  );
}
