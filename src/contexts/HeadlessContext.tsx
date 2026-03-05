import React, { createContext, useState } from 'react';
import { useFrame } from '@react-three/fiber';

export const HeadlessContext = createContext<{
    isHeadless: boolean;
    setIsHeadless: (v: boolean) => void;
    timeScale: number;
    setTimeScale: (v: number) => void;
    batchSize: number;
    setBatchSize: (v: number) => void;
    metrics: { simStepsPerSec: number, robots: number };
    setMetrics: (m: any) => void;
}>({
    isHeadless: false,
    setIsHeadless: () => { },
    timeScale: 1,
    setTimeScale: () => { },
    batchSize: 1,
    setBatchSize: () => { },
    metrics: { simStepsPerSec: 0, robots: 0 },
    setMetrics: () => { },
});

export function HeadlessProvider({ children }: { children: React.ReactNode }) {
    const [isHeadless, setIsHeadless] = useState(false);
    const [timeScale, setTimeScale] = useState(1);
    const [batchSize, setBatchSize] = useState(1);
    const [metrics, setMetrics] = useState({ simStepsPerSec: 0, robots: 0 });

    return (
        <HeadlessContext.Provider value={{
            isHeadless, setIsHeadless,
            timeScale, setTimeScale,
            batchSize, setBatchSize,
            metrics, setMetrics
        }}>
            {children}
        </HeadlessContext.Provider>
    );
}

// ── Simulation Loop ──────────────────────────────────────────────────────────
// With server-authoritative physics, the simulation loop is simplified:
// all physics stepping happens on the server. The frontend just uses useFrame
// for rendering-driven callbacks (joint animation, sensor polling, etc.)

export function useSimulationLoop(
    preStep?: (delta: number) => void,
    postStep?: (delta: number) => void
) {
    useFrame((_, delta) => {
        if (preStep) preStep(delta);
        if (postStep) postStep(delta);
    });
}
