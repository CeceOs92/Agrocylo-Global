"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { API_BASE_URL } from "@/lib/apiConfig";

const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const RECONNECT_MULTIPLIER = 2;

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());
  const seenMessageIds = useRef<Set<string>>(new Set());
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (unmounted.current) return;

    const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws";
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      reconnectAttempt.current = 0;
    };

    socket.onclose = () => {
      setIsConnected(false);
      if (unmounted.current) return;
      // Exponential backoff reconnect
      const delay = Math.min(
        RECONNECT_BASE_DELAY_MS * Math.pow(RECONNECT_MULTIPLIER, reconnectAttempt.current),
        RECONNECT_MAX_DELAY_MS,
      );
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(() => connectRef.current(), delay);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          event?: string;
          id?: string;
          payload?: unknown;
        };

        // Deduplicate by message id if present
        if (data.id) {
          if (seenMessageIds.current.has(data.id)) return;
          seenMessageIds.current.add(data.id);
          // Keep the dedup set bounded
          if (seenMessageIds.current.size > 500) {
            const first = seenMessageIds.current.values().next().value;
            if (first !== undefined) seenMessageIds.current.delete(first);
          }
        }

        if (data.event) {
          const eventListeners = listenersRef.current.get(data.event);
          if (eventListeners) {
            eventListeners.forEach((cb) => cb(data.payload));
          }
        }
      } catch (err) {
        console.error("[useSocket] Failed to parse message", err);
      }
    };
  }, []);

  useEffect(() => {
    unmounted.current = false;
    connectRef.current = connect;
    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
    };
  }, [connect]);

  const on = useCallback((event: string, callback: (data: unknown) => void) => {
    const map = listenersRef.current;
    if (!map.has(event)) map.set(event, new Set());
    map.get(event)!.add(callback);

    return () => {
      const listeners = map.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) map.delete(event);
      }
    };
  }, []);

  const emit = useCallback((type: string, payload: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  return { isConnected, on, emit };
}
