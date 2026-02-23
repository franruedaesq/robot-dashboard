import { BufferedTFTree, Transform, Vec3, Quaternion } from 'tf-engine';

// Keep 1 second of history (1000ms)
// This is plenty for our 60Hz physics and 10Hz/20Hz sensors
export const tfTree = new BufferedTFTree({ maxBufferDuration: 1000 });

// Ensure the root world frame always exists
tfTree.addFrame("world");

export { Transform, Vec3, Quaternion };
