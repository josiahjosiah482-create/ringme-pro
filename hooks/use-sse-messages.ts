/**
 * Hook for real-time message delivery via Server-Sent Events (SSE).
 * Uses react-native-sse on Android/iOS and the built-in EventSource on web.
 * Falls back to polling (handled by the caller) if SSE fails.
 */

import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Platform-aware EventSource: react-native-sse on native, built-in on web
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CrossPlatformEventSource: any =
  Platform.OS !== "web"
    ? require("react-native-sse").default
    // Use globalThis to avoid ReferenceError in Metro bundler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (globalThis as any).EventSource ?? null;

type SSEMessage = {
  type: "connected" | "new_message" | "conversations_updated" | "ping";
  conversationId?: number;
  message?: {
    id?: number;
    text: string;
    isMe: boolean;
    createdAt: string;
  };
};

type UseSSEMessagesOptions = {
  conversationId: number;
  userId: number;
  onNewMessage?: (message: NonNullable<SSEMessage["message"]>) => void;
  onConversationsUpdated?: () => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  enabled?: boolean;
};

const API_BASE =
  Constants.expoConfig?.extra?.apiUrl ??
  (process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:3000");

export function useSSEMessages({
  conversationId,
  userId,
  onNewMessage,
  onConversationsUpdated,
  onConnected,
  onDisconnected,
  enabled = true,
}: UseSSEMessagesOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const esRef = useRef<any>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!enabled || !conversationId || !userId) return;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const url = `${API_BASE}/api/sse?conversationId=${conversationId}&userId=${userId}`;
    // react-native-sse supports headers; web EventSource does not
    const es = new CrossPlatformEventSource(url, {
      headers: { Accept: "text/event-stream" },
    });
    esRef.current = es;

    es.onopen = () => {
      if (mountedRef.current) {
        onConnected?.();
      }
    };

    es.onmessage = (event: { data: string }) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data) as SSEMessage;
        if (data.type === "new_message" && data.message) {
          onNewMessage?.(data.message);
        } else if (data.type === "conversations_updated") {
          onConversationsUpdated?.();
        }
      } catch {
        // Ignore parse errors (e.g. ping events)
      }
    };

    es.onerror = () => {
      if (mountedRef.current) {
        onDisconnected?.();
      }
      es.close();
      esRef.current = null;
      if (!mountedRef.current) return;
      // Reconnect after 5 seconds
      reconnectTimer.current = setTimeout(connect, 5000);
    };
  }, [conversationId, userId, enabled, onNewMessage, onConversationsUpdated, onConnected, onDisconnected]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [connect]);
}
