import React, { useCallback, useEffect, useRef, useState } from 'react';
import { emitTestLog } from '../api';

interface RunLogsProps {
  runId: string;
  className?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

export function RunLogs({ runId, className = '' }: RunLogsProps) {
  const [connected, setConnected] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [isEmitting, setIsEmitting] = useState(false);
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

  const clear = () => setLines([]);

  const handleEmitTest = async () => {
    if (!runId.trim()) return;

    setIsEmitting(true);
    try {
      await emitTestLog(runId.trim());
    } catch (error) {
      console.error('Failed to emit test log:', error);
    } finally {
      setIsEmitting(false);
    }
  };

  useEffect(() => () => esRef.current?.close(), []);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Logs</h3>
        <div className="flex gap-2">
          {!connected ? (
            <button
              onClick={connect}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm hover:bg-indigo-500"
            >
              Connect
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm hover:bg-rose-500"
            >
              Disconnect
            </button>
          )}
          <button
            onClick={clear}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm border border-slate-700"
          >
            Clear
          </button>
          <button
            onClick={handleEmitTest}
            disabled={isEmitting}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50"
            title="POST /runs/:id/logs/test"
          >
            {isEmitting ? 'Emitting...' : 'Emit test'}
          </button>
        </div>
      </div>

      <div className="text-sm text-slate-400">
        {connected ? 'Connected' : 'Disconnected'} • API: {API_BASE}
      </div>

      <pre className="rounded-xl bg-black/40 border border-slate-800 p-4 max-h-[60dvh] overflow-auto text-sm leading-6">
        {lines.map((l, i) => (
          <span key={i}>{l}\n</span>
        ))}
      </pre>
    </div>
  );
}
