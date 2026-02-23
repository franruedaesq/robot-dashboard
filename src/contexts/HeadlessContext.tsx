import React, { createContext, useContext, useState, useEffect } from 'react';
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

class HeadlessSimulationManager {
    static preStepSubscribers = new Set<(delta: number) => void>();
    static postStepSubscribers = new Set<(delta: number) => void>();
}

export const HeadlessManager = HeadlessSimulationManager;

export function useSimulationLoop(
    preStep?: (delta: number) => void,
    postStep?: (delta: number) => void
) {
    const { isHeadless } = useContext(HeadlessContext);

    // En modo normal, usamos useFrame.
    useFrame((_, delta) => {
        if (!isHeadless) {
            if (preStep) preStep(delta);
            if (postStep) postStep(delta);
        }
    });

    // En modo headless nos suscribimos al manager global manual
    useEffect(() => {
        if (!isHeadless) return;
        if (preStep) HeadlessManager.preStepSubscribers.add(preStep);
        if (postStep) HeadlessManager.postStepSubscribers.add(postStep);

        return () => {
            if (preStep) HeadlessManager.preStepSubscribers.delete(preStep);
            if (postStep) HeadlessManager.postStepSubscribers.delete(postStep);
        };
    }, [isHeadless, preStep, postStep]);
}
