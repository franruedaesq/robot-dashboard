import { createContext, useCallback, useContext } from 'react';
import { useCrdtState, type CrdtStatus } from '@crdt-sync/react';
import wasmUrl from '@crdt-sync/core/pkg/web/crdt_sync_bg.wasm?url';
import type { ObstacleConfig } from '../types';

// ── Shared state shape ────────────────────────────────────────────────────────
export type SharedRobotState = {
    urdfText: string;
    pkgMap: Record<string, string>;
    forwardAngle: number;
    visualYOffset: number;
};

type WorldState = {
    obstacles: ObstacleConfig[];
    sharedRobot?: SharedRobotState;
};

const INITIAL_STATE: WorldState = { obstacles: [] };
const WS_URL = 'ws://localhost:8002';
const ROOM_ID = 'world';

// ── Context value exposed to consumers ───────────────────────────────────────
type CrdtWorldContextValue = {
    obstacles: ObstacleConfig[];
    setObstacles: (obs: ObstacleConfig[]) => void;
    sharedRobot?: SharedRobotState;
    setSharedRobot: (robot: SharedRobotState) => void;
    status: CrdtStatus;
};

export const CrdtWorldContext = createContext<CrdtWorldContextValue>({
    obstacles: [],
    setObstacles: () => { },
    setSharedRobot: () => { },
    status: 'connecting',
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function CrdtWorldProvider({ children }: { children: React.ReactNode }) {
    const { state, proxy, status } = useCrdtState<WorldState>(
        WS_URL,
        ROOM_ID,
        INITIAL_STATE,
        { wasmUrl }
    );

    const setObstacles = useCallback((obs: ObstacleConfig[]) => {
        if (proxy) proxy.state.obstacles = obs;
    }, [proxy]);

    const setSharedRobot = useCallback((robot: SharedRobotState) => {
        if (proxy) proxy.state.sharedRobot = robot;
    }, [proxy]);

    return (
        <CrdtWorldContext.Provider value={{
            obstacles: state.obstacles ?? [],
            setObstacles,
            sharedRobot: state.sharedRobot,
            setSharedRobot,
            status
        }}>
            {children}
        </CrdtWorldContext.Provider>
    );
}

export const useCrdtWorld = () => useContext(CrdtWorldContext);
