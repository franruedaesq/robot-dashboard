import { describe, it, expect, beforeEach } from 'vitest';
import { BufferedTFTree, Transform, Vec3 } from 'tf-engine';

describe('TF Engine Integration', () => {
    let tfTree: BufferedTFTree;

    beforeEach(() => {
        // Reset the tree before each test
        tfTree = new BufferedTFTree({ maxBufferDuration: 1000 });
        tfTree.addFrame("world");
    });

    it('should initialize with world frame', () => {
        expect(tfTree.hasFrame("world")).toBe(true);
    });

    it('should compute absolute world origin of LiDAR mounted on base_link', () => {
        tfTree.addFrame("base_link", "world");
        tfTree.addFrame("sim_lidar", "base_link", new Transform(new Vec3(0, 0.18, 0)));

        // Move the robot forward by 2 units on X axis
        const now = Date.now();
        tfTree.setTransform("base_link", new Transform(new Vec3(2, 0, 0)), now);

        // Query lidar world position
        const t = tfTree.getTransformAt("world", "sim_lidar", now);

        // LiDAR should be at X=2 (from base) and Y=0.18 (from its own offset)
        expect(t.translation.x).toBeCloseTo(2);
        expect(t.translation.y).toBeCloseTo(0.18);
        expect(t.translation.z).toBeCloseTo(0);
    });

    it('should correctly interpolate historical transforms', () => {
        tfTree.addFrame("base_link", "world");

        const time1 = 1000;
        const time2 = 2000;

        tfTree.setTransform("base_link", new Transform(new Vec3(0, 0, 0)), time1);
        tfTree.setTransform("base_link", new Transform(new Vec3(10, 0, 0)), time2);

        // Interpolate exactly halfway
        const t = tfTree.getTransformAt("world", "base_link", 1500);

        expect(t.translation.x).toBeCloseTo(5);
        expect(t.translation.y).toBeCloseTo(0);
        expect(t.translation.z).toBeCloseTo(0);
    });
});
