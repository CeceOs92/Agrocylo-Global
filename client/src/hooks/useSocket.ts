"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { API_BASE_URL } from "@/lib/apiConfig";

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const [listeners, setListeners] = useState<
    Map<string, Set<(data: unknown) => void>>
  >(new Map());

  useEffect(() => {
    // Derive WebSocket URL from the same backend base URL used for REST,
    // so a single NEXT_PUBLIC_API_URL configures the entire backend connection.
    const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws";
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event) {
          const eventListeners = listeners.get(data.event);
          if (eventListeners) {
            eventListeners.forEach((callback) => callback(data.payload));
          }
        }
      } catch (err) {
        console.error("[useSocket] Failed to parse message", err);
      }
    };

    return () => {
      socket.close();
    };
  }, [listeners]);

  const on = useCallback((event: string, callback: (data: unknown) => void) => {
    setListeners((prev) => {
      const next = new Map(prev);
      const eventListeners = next.get(event) || new Set();
      eventListeners.add(callback);
      next.set(event, eventListeners);
      return next;
    });

    return () => {
      setListeners((prev) => {
        const next = new Map(prev);
        const eventListeners = next.get(event);
        if (eventListeners) {
          eventListeners.delete(callback);
          if (eventListeners.size === 0) {
            next.delete(event);
          }
        }
        return next;
      });
    };
  }, []);

  const emit = useCallback((type: string, payload: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  return { isConnected, on, emit };
}
