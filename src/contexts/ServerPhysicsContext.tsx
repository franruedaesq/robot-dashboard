import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
export interface PhysicsEntry {
    entity_id: string;
    position: [number, number, number];
    rotation: [number, number, number, number]; // qx, qy, qz, qw
}

interface ServerPhysicsState {
    /** Latest snapshot entries from the server, keyed by entity_id */
    getEntry: (entityId: string) => PhysicsEntry | undefined;
    /** Send a cmd_vel command to the server physics engine */
    sendCmdVel: (linear: number, angular: number) => void;
    /** Whether the WebSocket is currently connected */
    connected: boolean;
}

const ServerPhysicsContext = createContext<ServerPhysicsState>({
    getEntry: () => undefined,
    sendCmdVel: () => { },
    connected: false,
});

// ── Provider ─────────────────────────────────────────────────────────────────
const PHYSICS_WS_URL = 'ws://localhost:8003';

export function ServerPhysicsProvider({ children }: { children: React.ReactNode }) {
    const wsRef = useRef<WebSocket | null>(null);
    const entriesRef = useRef<Map<string, PhysicsEntry>>(new Map());
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let ws: WebSocket;
        let reconnectTimer: ReturnType<typeof setTimeout>;

        function connect() {
            ws = new WebSocket(PHYSICS_WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('⚛️ Connected to physics server');
                setConnected(true);
            };

            ws.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(ev.data);
                    if (msg.type === 'snapshot' && Array.isArray(msg.entries)) {
                        const map = entriesRef.current;
                        for (const entry of msg.entries as PhysicsEntry[]) {
                            map.set(entry.entity_id, entry);
                        }
                    }
                } catch { /* ignore malformed */ }
            };

            ws.onclose = () => {
                setConnected(false);
                wsRef.current = null;
                // Reconnect after 2s
                reconnectTimer = setTimeout(connect, 2000);
            };

            ws.onerror = () => {
                ws.close();
            };
        }

        connect();

        return () => {
            clearTimeout(reconnectTimer);
            ws?.close();
        };
    }, []);

    const getEntry = useCallback((entityId: string) => {
        return entriesRef.current.get(entityId);
    }, []);

    const sendCmdVel = useCallback((linear: number, angular: number) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'cmd_vel', linear, angular }));
        }
    }, []);

    return (
        <ServerPhysicsContext.Provider value={{ getEntry, sendCmdVel, connected }}>
            {children}
        </ServerPhysicsContext.Provider>
    );
}

// ── Hooks ────────────────────────────────────────────────────────────────────
export function useServerPhysics() {
    return useContext(ServerPhysicsContext);
}
