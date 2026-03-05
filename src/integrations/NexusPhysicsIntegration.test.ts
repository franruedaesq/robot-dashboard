import { describe, it, expect } from 'vitest';
import { WasmPhysicsWorld } from '@nexus-physics/core';

/**
 * Integration test for @nexus-physics/core running in Node.js.
 * Verifies the Wasm physics engine steps correctly server-side,
 * which is the foundation of the server-authoritative architecture.
 *
 * Note: When inlined via vite-plugin-wasm, the Wasm init happens
 * automatically on import — no need to call init() manually.
 */
describe('@nexus-physics/core — Node.js Integration', () => {
    it('initialises a WasmPhysicsWorld and steps a dynamic body', () => {
        // Constructor: WasmPhysicsWorld(gx, gy, gz)
        const world = new WasmPhysicsWorld(0, -9.81, 0);

        // add_body(entity_id, body_type_str, shape_type, dims, px, py, pz)
        // Add a static floor
        world.add_body('floor', 'static', 'cuboid', new Float32Array([20, 0.05, 20]), 0, -0.05, 0);

        // Add a dynamic ball above the floor
        world.add_body('ball', 'dynamic', 'ball', new Float32Array([0.25]), 0, 5, 0);

        // Record initial position
        const posBefore = world.get_position('ball');
        expect(posBefore[1]).toBeCloseTo(5, 1); // y ≈ 5

        // Step 60 times (1 second of simulation)
        for (let i = 0; i < 60; i++) {
            world.step(1 / 60);
        }

        // Ball should have fallen due to gravity
        const posAfter = world.get_position('ball');
        expect(posAfter[1]).toBeLessThan(posBefore[1]);

        // Snapshot should contain the ball (only dynamic bodies appear)
        const buffer = world.get_snapshot_view();
        expect(buffer.length).toBeGreaterThanOrEqual(8); // at least one body × 8 floats
    });

    it('applies velocity to a body via set_velocity', () => {
        const world = new WasmPhysicsWorld(0, -9.81, 0);

        // Floor
        world.add_body('floor', 'static', 'cuboid', new Float32Array([20, 0.05, 20]), 0, -0.05, 0);

        // Robot body (will be pushed forward)
        world.add_body('robot', 'dynamic', 'cuboid', new Float32Array([0.15, 0.1, 0.15]), 0, 0.3, 0);

        const xBefore = world.get_position('robot')[0];

        // Push forward (positive X) at 2 m/s for 1 second
        // set_velocity(entity_id, lx, ly, lz, ax, ay, az)
        for (let i = 0; i < 60; i++) {
            world.set_velocity('robot', 2, 0, 0, 0, 0, 0);
            world.step(1 / 60);
        }

        const xAfter = world.get_position('robot')[0];
        // Robot should have moved significantly in +X
        expect(xAfter).toBeGreaterThan(xBefore + 0.5);

        // Apply angular velocity
        const rotBefore = world.get_rotation('robot');
        const rotBeforeY = rotBefore[1]; // copy before buffer invalidation
        for (let i = 0; i < 30; i++) {
            world.set_velocity('robot', 0, 0, 0, 0, 1, 0);
            world.step(1 / 60);
        }
        const rotAfter = world.get_rotation('robot');

        // Quaternion should have changed (robot rotated)
        expect(rotAfter[1]).not.toBeCloseTo(rotBeforeY, 2);
    });
});
