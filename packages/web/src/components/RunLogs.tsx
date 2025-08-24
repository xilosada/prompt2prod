import React, { useCallback, useEffect, useRef, useState } from 'react';
import { emitTestLog } from '../api';

interface RunLogsProps {
  runId: string;
  className?: string;
  onConnectionChange?: (connected: boolean, paused: boolean) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';
const MAX_LINES = 1000;

export function RunLogs({ runId, className = '', onConnectionChange }: RunLogsProps) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [isEmitting, setIsEmitting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userDisconnectedRef = useRef(false);

  const connect = useCallback(() => {
    if (connected || connecting || !runId.trim()) return;

    setConnecting(true);
    setReconnectAttempts(0);
    setShowReconnectBanner(false);
    userDisconnectedRef.current = false;

    const url = `${API_BASE}/runs/${encodeURIComponent(runId.trim())}/logs/stream`;
    const es = new EventSource(url, { withCredentials: false });

    es.onopen = () => {
      setConnected(true);
      setConnecting(false);
      setReconnectAttempts(0);
      setShowReconnectBanner(false);
      onConnectionChange?.(true, paused);
    };

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        setLines((prev) => {
          const newLines = [...prev, String(data)];
          // Keep only the last MAX_LINES
          return newLines.slice(-MAX_LINES);
        });
      } catch {
        setLines((prev) => {
          const newLines = [...prev, ev.data];
          return newLines.slice(-MAX_LINES);
        });
      }
    };

    es.onerror = () => {
      es.close();
      setConnected(false);
      setConnecting(false);
      onConnectionChange?.(false, paused);

      // Only attempt reconnect if user didn't manually disconnect
      if (!userDisconnectedRef.current && reconnectAttempts < 3) {
        const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 5000);
        setShowReconnectBanner(true);
        setReconnectAttempts((prev) => prev + 1);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (!userDisconnectedRef.current) {
            connect();
          }
        }, backoffDelay);
      }
    };

    esRef.current = es;
  }, [connected, connecting, runId, reconnectAttempts]);

  const disconnect = useCallback(() => {
    userDisconnectedRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    esRef.current?.close();
    esRef.current = null;
    setConnected(false);
    setConnecting(false);
    setReconnectAttempts(0);
    setShowReconnectBanner(false);
    onConnectionChange?.(false, paused);
  }, [onConnectionChange, paused]);

  const clear = () => setLines([]);

  const handlePauseToggle = () => {
    const newPaused = !paused;
    setPaused(newPaused);
    onConnectionChange?.(connected, newPaused);
  };

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

  useEffect(() => {
    return () => {
      userDisconnectedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      esRef.current?.close();
    };
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Reconnect banner */}
      {showReconnectBanner && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-sm text-yellow-200">
          <div className="flex items-center justify-between">
            <span>Disconnected — retrying... (attempt {reconnectAttempts}/3)</span>
            <button
              onClick={disconnect}
              className="text-yellow-300 hover:text-yellow-100 underline"
            >
              Stop retrying
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Logs</h3>
        <div className="flex gap-2">
          {!connected ? (
            <button
              onClick={connect}
              disabled={connecting}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="connect-btn"
            >
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm hover:bg-rose-500"
              data-testid="disconnect-btn"
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
            onClick={handlePauseToggle}
            className={`rounded-lg px-3 py-2 text-sm border ${
              paused
                ? 'bg-orange-600 border-orange-500 text-orange-100'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          {import.meta.env.VITE_HIDE_DEV_TOOLS !== 'true' && (
            <button
              onClick={handleEmitTest}
              disabled={isEmitting}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50"
              title="POST /runs/:id/logs/test"
              data-testid="emit-test-btn"
            >
              {isEmitting ? 'Emitting...' : 'Emit test'}
            </button>
          )}
        </div>
      </div>

      <div className="text-sm text-slate-400" data-testid="connection-status">
        {connected ? 'Connected' : 'Disconnected'} • API: {API_BASE}
        {paused && ' • Paused'}
      </div>

      {lines.length === 0 ? (
        <div className="rounded-xl bg-black/40 border border-slate-800 p-8 text-center text-slate-400">
          {connected ? 'No logs received yet' : 'Connect to stream logs'}
        </div>
      ) : (
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-atomic="false"
          className="rounded-xl bg-black/40 border border-slate-800 p-4 max-h-[60dvh] overflow-auto text-sm leading-6 font-mono"
          data-testid="log-container"
        >
          {lines.map((l, i) => (
            <div key={i} data-testid="log-line" className="whitespace-pre-wrap">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
