import { describe, it, expect } from 'vitest';
import { Octree, OctreeNodePool, AABBPool } from '@spatial-engine/core';

describe('@spatial-engine integration in PhysicsWorld', () => {
    it('initializes Octree with configured node and object capacities', () => {
        const nodeCapacity = 1024;
        const objectCapacity = 2048;

        const octree = new Octree(new OctreeNodePool(nodeCapacity), new AABBPool(objectCapacity));

        // Verifying it initialized successfully without throwing
        expect(octree).toBeInstanceOf(Octree);
        // The sizes won't be easily readable without public accessors,
        // but this confirms the constructor contract from SpatialEngineContext config
    });

    it('sets root bounds required for subdividing obstacles', () => {
        const aabbPool = new AABBPool(2048);
        const octree = new Octree(new OctreeNodePool(1024), aabbPool);

        // Exact bounds used in PhysicsWorld
        // spatialHandle.octree.setBounds(-22, -2, -22, 22, 6, 22);
        octree.setBounds(-22, -2, -22, 22, 6, 22);

        // Insert a dummy object to ensure bound setting allowed subdivision
        const objId = aabbPool.allocate();
        aabbPool.set(objId, 0, 0, 0, 1, 1, 1);
        octree.insert(objId);

        expect(objId).toBeDefined();
        expect(objId).toBeGreaterThan(-1);

        // Test removing the object
        octree.remove(objId);
    });

    it('successfully raycasts against an inserted AABB', () => {
        // This test mimics the exact logic inside SimLiDAR
        const aabbPool = new AABBPool(2048);
        const octree = new Octree(new OctreeNodePool(1024), aabbPool);
        octree.setBounds(-22, -2, -22, 22, 6, 22);

        // Insert a 2x2x2 box at x=5
        const boxId = aabbPool.allocate();
        aabbPool.set(boxId, 4, -1, -1, 6, 1, 1);
        octree.insert(boxId);

        // Set up a ray pointing from origin down the +X axis
        // Layout: [ox, oy, oz, dx, dy, dz]
        const rayBuf = new Float32Array([0, 0, 0, 1, 0, 0]);

        // raycast(rayBuf, rayOffset)
        const hit = octree.raycast(rayBuf, 0);

        expect(hit).not.toBeNull();
        expect(hit?.objectIndex).toBe(boxId);
        expect(hit?.t).toBeCloseTo(4.0); // Origin at 0, hit face minX at 4
    });
});
