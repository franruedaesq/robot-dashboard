import { useContext, useEffect } from 'react';
import { useRapier } from '@react-three/rapier';
import { HeadlessContext, HeadlessManager } from '../contexts/HeadlessContext';

export function HeadlessEngine() {
    const { isHeadless, timeScale, setMetrics } = useContext(HeadlessContext);
    const { world } = useRapier();

    useEffect(() => {
        if (!isHeadless) return;

        let rafId: number;
        let lastRealTime = performance.now();
        let stepsAccumulator = 0;
        let lastMetricsTime = performance.now();

        const FIXED_TIMESTEP = 1 / 60; // Rapier default timestep is 1/60

        const loop = () => {
            const now = performance.now();

            // Limit iterative chunking to avoid complete freezes
            const chunkTime = Math.min((now - lastRealTime) / 1000, 0.1);
            lastRealTime = now;

            // Compute how many 1/60 steps we need to execute this frame to reach chunkTime * timeScale
            // Note: If timeScale is 10, and RAF runs at 60Hz, this is ~10 steps per RAF.
            const targetSimTime = chunkTime * timeScale;
            const stepsThisFrame = Math.max(1, Math.round(targetSimTime / FIXED_TIMESTEP));

            for (let i = 0; i < stepsThisFrame; i++) {
                // 1. Pre-step callbacks (control, sensors, joints)
                HeadlessManager.preStepSubscribers.forEach(cb => cb(FIXED_TIMESTEP));

                // 2. Step Rapier World
                world.step();
                stepsAccumulator++;

                // 3. Post-step callbacks (lidar rays, odometry)
                HeadlessManager.postStepSubscribers.forEach(cb => cb(FIXED_TIMESTEP));
            }

            // Update metrics every roughly 1 second
            if (now - lastMetricsTime >= 1000) {
                setMetrics((m: any) => ({ ...m, simStepsPerSec: stepsAccumulator }));
                stepsAccumulator = 0;
                lastMetricsTime = now;
            }

            rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(rafId);
    }, [isHeadless, timeScale, world, setMetrics]);

    return null;
}
