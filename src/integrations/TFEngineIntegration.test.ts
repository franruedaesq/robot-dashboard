import { describe, it, expect } from 'vitest';
import { BufferedTFTree, Vec3, Quaternion, Transform } from '@tf-engine/core';

describe('@tf-engine integration in TFEngineContext', () => {
    it('initializes a BufferedTFTree with 1000ms history', () => {
        // The setup from TFEngineContext
        const tree = new BufferedTFTree({ maxBufferDuration: 1000 });

        expect(tree).toBeInstanceOf(BufferedTFTree);
    });

    it('adds the root "world" frame on initialization', () => {
        const tree = new BufferedTFTree({ maxBufferDuration: 1000 });

        // Ensure "world" frame exists before any others
        tree.addFrame('world');

        // If we add another frame as a child of world, it should work
        tree.addFrame('base_link');

        // Set transform from world -> base_link
        tree.setTransform('base_link', new Transform(new Vec3(1, 0, 0), new Quaternion(0, 0, 0, 1)), 100);

        // Evaluate Transform at timestamp 100
        const transform = tree.getTransformAt('world', 'base_link', 100);

        expect(transform).not.toBeNull();
        expect(transform?.translation.x).toBe(1);
        expect(transform?.translation.y).toBe(0);
        expect(transform?.translation.z).toBe(0);
        expect(transform?.rotation.w).toBe(1);
    });

    it('successfully evaluates deep transform chains across multiple frames', () => {
        // This validates the logic used for offsetting sensors like SimLiDAR from the base
        const tree = new BufferedTFTree({ maxBufferDuration: 1000 });
        tree.addFrame('world');
        tree.addFrame('base_link', 'world');
        tree.addFrame('laser_frame', 'base_link');

        // robot moving forward 2m in world
        tree.setTransform('base_link', new Transform(new Vec3(2, 0, 0), Quaternion.identity()), 500);

        // laser mounted 0.5m higher than base_link
        tree.setTransform('laser_frame', new Transform(new Vec3(0, 0.5, 0), Quaternion.identity()), 500);

        // evaluate laser_frame in world coordinates
        const laserInWorld = tree.getTransformAt('world', 'laser_frame', 500);

        expect(laserInWorld.translation.x).toBeCloseTo(2); // From base_link
        expect(laserInWorld.translation.y).toBeCloseTo(0.5); // From laser_frame offset
        expect(laserInWorld.translation.z).toBeCloseTo(0);

        // Evaluate the reverse (world in laser_frame) to verify matrix inversions
        const worldInLaser = tree.getTransformAt('laser_frame', 'world', 500);
        expect(worldInLaser.translation.x).toBeCloseTo(-2);
        expect(worldInLaser.translation.y).toBeCloseTo(-0.5);
    });
});
