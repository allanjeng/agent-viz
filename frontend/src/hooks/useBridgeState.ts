import { useEffect, useMemo, useState } from "react";

import { BridgeStateMessage, DashboardSnapshot } from "../types";

const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL ?? "ws://localhost:3002";
const RECONNECT_DELAY_MS = 2000;

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  agents: [],
  stats: {
    sessionCount: 0,
    activeContractors: 0,
    updatedAt: new Date(0).toISOString(),
  },
  events: [],
};

export type ConnectionState = "connecting" | "open" | "closed";

export function useBridgeState(): {
  snapshot: DashboardSnapshot;
  connectionState: ConnectionState;
  bridgeUrl: string;
} {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_SNAPSHOT);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let cancelled = false;

    const connect = () => {
      if (cancelled) {
        return;
      }

      setConnectionState("connecting");
      socket = new WebSocket(BRIDGE_URL);

      socket.onopen = () => {
        setConnectionState("open");
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(event.data) as BridgeStateMessage;

          if (parsed.type === "state" && parsed.data) {
            setSnapshot(parsed.data);
          }
        } catch {
          // Ignore malformed messages from non-bridge sources.
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (cancelled) {
          return;
        }

        setConnectionState("closed");
        retryTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      cancelled = true;

      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }

      socket?.close();
    };
  }, []);

  const stableSnapshot = useMemo(() => snapshot, [snapshot]);

  return {
    snapshot: stableSnapshot,
    connectionState,
    bridgeUrl: BRIDGE_URL,
  };
}
