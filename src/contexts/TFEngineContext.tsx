import { createContext, useContext, useState } from 'react';
import { BufferedTFTree } from '@tf-engine/core';

export const TFEngineContext = createContext<BufferedTFTree | null>(null);

export function TFEngineProvider({ children }: { children: React.ReactNode }) {
    const [tfTree] = useState(() => {
        // Keep 1 second of history (1000ms)
        const tree = new BufferedTFTree({ maxBufferDuration: 1000 });
        // Ensure the root world frame always exists
        tree.addFrame("world");
        return tree;
    });

    return (
        <TFEngineContext.Provider value={tfTree}>
            {children}
        </TFEngineContext.Provider>
    );
}

export function useTFEngine() {
    const tree = useContext(TFEngineContext);
    if (!tree) {
        throw new Error('useTFEngine must be used within a TFEngineProvider');
    }
    return tree;
}
