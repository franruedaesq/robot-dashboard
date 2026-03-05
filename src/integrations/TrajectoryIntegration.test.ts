import { describe, it, expect } from 'vitest';
import { TrajectoryBuilder } from 'ts-trajectory';

describe('ts-trajectory integration in RobotArmPanel', () => {
    it('plans a smooth cubic trajectory for a live joint state update (0.25s)', () => {
        const builder = new TrajectoryBuilder();
        const currentPos = 0.0;
        const targetPos = 1.5;

        const traj = builder.plan([
            { time: 0, positions: [currentPos] },
            { time: 0.25, positions: [targetPos] }
        ], { interpolationType: 'cubic' });

        expect(traj.getDuration()).toBeCloseTo(0.25);

        // Start position
        expect(traj.sample(0)[0]).toBeCloseTo(currentPos);

        // Midpoint should be halfway due to cubic interpolation symmetry
        expect(traj.sample(0.125)[0]).toBeCloseTo(0.75);

        // End position
        expect(traj.sample(0.25)[0]).toBeCloseTo(targetPos);
    });

    it('plans a smooth cubic trajectory for manual slider input (0.5s)', () => {
        const builder = new TrajectoryBuilder();
        const currentPos = -1.0;
        const targetPos = 1.0;

        const traj = builder.plan([
            { time: 0, positions: [currentPos] },
            { time: 0.5, positions: [targetPos] }
        ], { interpolationType: 'cubic' });

        expect(traj.getDuration()).toBeCloseTo(0.5);
        expect(traj.sample(0)[0]).toBeCloseTo(currentPos);
        expect(traj.sample(0.5)[0]).toBeCloseTo(targetPos);
    });

    it('interpolates multiple chained waypoints smoothly', () => {
        const builder = new TrajectoryBuilder();
        const traj = builder.plan([
            { time: 0, positions: [0] },
            { time: 0.25, positions: [1.0] },
            { time: 0.60, positions: [-0.5] }
        ], { interpolationType: 'cubic' });

        expect(traj.getDuration()).toBeCloseTo(0.60);
        expect(traj.sample(0)[0]).toBeCloseTo(0);
        expect(traj.sample(0.25)[0]).toBeCloseTo(1.0);
        expect(traj.sample(0.60)[0]).toBeCloseTo(-0.5);
    });

    it('clamps to the final position if sampled past the maximum duration', () => {
        const builder = new TrajectoryBuilder();
        const traj = builder.plan([
            { time: 0, positions: [0] },
            { time: 0.5, positions: [2.5] }
        ], { interpolationType: 'cubic' });

        // Evaluated at exact duration
        expect(traj.sample(0.5)[0]).toBeCloseTo(2.5);

        // Evaluated *way* past duration -- should not error or wildly extrapolate
        expect(traj.sample(5.0)[0]).toBeCloseTo(2.5);
    });
});
