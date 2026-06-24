"use client";

import { useEffect, useRef, useCallback } from "react";

function getWebSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window === "undefined") return "ws://localhost:5001/ws";
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.hostname}:5001/ws`;
}

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const MAX_QUEUE_SIZE = 100;

export type WsMessage = {
  event: string;
  payload: unknown;
  timestamp: string;
};

type Handler = (msg: WsMessage) => void;

export function useWebSocket(onMessage: Handler) {
  const socketRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef<Handler>(onMessage);
  const attemptRef = useRef(0);
  const messageQueueRef = useRef<string[]>([]);
  const unmountedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  handlerRef.current = onMessage;

  const flushQueue = useCallback((ws: WebSocket) => {
    const queued = messageQueueRef.current.splice(0);
    for (const msg of queued) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined" || unmountedRef.current) return;

    const ws = new WebSocket(getWebSocketUrl());
    socketRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      flushQueue(ws);
    };

    ws.onmessage = (e) => {
      try {
        const msg: WsMessage = JSON.parse(e.data as string);
        handlerRef.current(msg);
      } catch {
        console.warn("[useWebSocket] Malformed message received:", e.data);
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      const attempt = attemptRef.current;
      const delay = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
      attemptRef.current = attempt + 1;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [flushQueue]);

  /** Queue a raw JSON string to be sent once the socket is open. */
  const send = useCallback((data: string) => {
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data);
    } else {
      if (messageQueueRef.current.length < MAX_QUEUE_SIZE) {
        messageQueueRef.current.push(data);
      }
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
    };
  }, [connect]);

  return { send };
}
