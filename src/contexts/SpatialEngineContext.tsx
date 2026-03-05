import { createContext, useContext } from 'react';
import type { OctreeHandle } from '@spatial-engine/react';

export const SpatialEngineContext = createContext<OctreeHandle | null>(null);

export function useSpatialEngineContext() {
    const handle = useContext(SpatialEngineContext);
    if (!handle) {
        throw new Error('useSpatialEngineContext must be used within a SpatialEngineContext.Provider');
    }
    return handle;
}
