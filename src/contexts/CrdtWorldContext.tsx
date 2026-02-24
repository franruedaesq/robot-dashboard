import { createContext, useCallback, useContext } from 'react';
import { useCrdtState, type CrdtStatus } from '@crdt-sync/react';
import wasmUrl from '@crdt-sync/core/pkg/web/crdt_sync_bg.wasm?url';
import type { ObstacleConfig } from '../types';

// ── Shared state shape ────────────────────────────────────────────────────────
type WorldState = {
    obstacles: ObstacleConfig[];
};

const INITIAL_STATE: WorldState = { obstacles: [] };
const WS_URL = 'ws://localhost:8002';

// ── Context value exposed to consumers ───────────────────────────────────────
type CrdtWorldContextValue = {
    obstacles: ObstacleConfig[];
    setObstacles: (obs: ObstacleConfig[]) => void;
    status: CrdtStatus;
};

export const CrdtWorldContext = createContext<CrdtWorldContextValue>({
    obstacles: [],
    setObstacles: () => {},
    status: 'connecting',
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function CrdtWorldProvider({ children }: { children: React.ReactNode }) {
    const { state, proxy, status } = useCrdtState<WorldState>(
        WS_URL,
        INITIAL_STATE,
        { wasmUrl }
    );

    const setObstacles = useCallback((obs: ObstacleConfig[]) => {
        if (proxy) proxy.state.obstacles = obs;
    }, [proxy]);

    return (
        <CrdtWorldContext.Provider value={{ obstacles: state.obstacles ?? [], setObstacles, status }}>
            {children}
        </CrdtWorldContext.Provider>
    );
}

export const useCrdtWorld = () => useContext(CrdtWorldContext);
