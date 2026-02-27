import { useEffect, useRef } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import * as ROSLIB from 'roslib';
import type { RobotPose } from '../types';
import { SENSOR_HZ, LIDAR_RAYS, LIDAR_MAX_DIST } from '../constants';
import { useSimulationLoop } from '../contexts/HeadlessContext';
import { Transform, Vec3 } from '@tf-engine/core';
import { useTFEngine } from '../contexts/TFEngineContext';
import { useSpatialEngineContext } from '../contexts/SpatialEngineContext';
import { RAY_STRIDE } from '@spatial-engine/core';

function gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdev + mean;
}

export function SimLiDAR({ bodyRef, ros, enabled, onPoseUpdate, robotIndex = 0 }: {
    bodyRef: React.RefObject<RapierRigidBody | null>;
    ros: ROSLIB.Ros | null;
    enabled: boolean;
    onPoseUpdate?: (p: RobotPose) => void;
    robotIndex?: number;
}) {
    const { octree } = useSpatialEngineContext();
    const tfTree = useTFEngine();
    const lastTime = useRef(0);
    const topicRef = useRef<ROSLIB.Topic<any> | null>(null);

    // Pre-allocate a single flat Float32Array to hold the ray data (ox,oy,oz,dx,dy,dz) 
    // to avoid triggering garbage collection during the high-frequency sweep.
    const rayBuffer = useRef(new Float32Array(RAY_STRIDE));

    useEffect(() => {
        if (!ros) return;
        const topicName = robotIndex === 0 ? '/sim_scan' : `/robot_${robotIndex}/sim_scan`;
        topicRef.current = new ROSLIB.Topic<any>({ ros, name: topicName, messageType: 'sensor_msgs/LaserScan' });

        // Register the lidar frame with tf-engine relative to base_link
        const frameId = robotIndex === 0 ? 'sim_lidar' : `robot_${robotIndex}/sim_lidar`;
        const parentFrameId = `robot_${robotIndex}/base_link`;

        // We ensure base_link exists just in case SimLiDAR mounts first
        if (!tfTree.hasFrame(parentFrameId)) {
            tfTree.addFrame(parentFrameId, "world");
        }

        if (!tfTree.hasFrame(frameId)) {
            // Hardcoded offset logic moved to one-time TF registration
            tfTree.addFrame(frameId, parentFrameId, new Transform(new Vec3(0, 0.18, 0)));
        }

        return () => { topicRef.current = null; };
    }, [ros, robotIndex]);

    useSimulationLoop(undefined, (delta) => {
        const body = bodyRef.current;
        if (!body) return;
        const t = body.translation();
        const r = body.rotation();
        const yaw = 2 * Math.atan2(r.y, r.w);
        onPoseUpdate?.({ x: t.x, y: t.y, z: t.z, yaw });

        if (!enabled) return;

        lastTime.current += delta;
        if (lastTime.current < 1 / SENSOR_HZ) return;
        lastTime.current = 0;

        const ranges: number[] = [];
        const ROBOT_RADIUS = 0.25; // Skip inner collider bounding box

        const frameId = robotIndex === 0 ? 'sim_lidar' : `robot_${robotIndex}/sim_lidar`;

        // Get the lidar's position in world space at this exact timestamp
        let lidarPos = { x: t.x, y: t.y + 0.18, z: t.z };
        if (tfTree.hasFrame(frameId)) {
            const transform = tfTree.getTransformAt("world", frameId, Date.now());
            lidarPos = { x: transform.translation.x, y: transform.translation.y, z: transform.translation.z };
        }

        for (let i = 0; i < LIDAR_RAYS; i++) {
            const angle = yaw + (i * Math.PI * 2) / LIDAR_RAYS;
            const dirX = Math.sin(angle);
            const dirZ = Math.cos(angle);

            const originX = lidarPos.x + dirX * ROBOT_RADIUS;
            const originY = lidarPos.y;
            const originZ = lidarPos.z + dirZ * ROBOT_RADIUS;

            // Load ray into fixed buffer [ox, oy, oz, dx, dy, dz]
            const buf = rayBuffer.current;
            buf[0] = originX;
            buf[1] = originY;
            buf[2] = originZ;
            buf[3] = dirX;
            buf[4] = 0;
            buf[5] = dirZ;

            const hit = octree.raycast(buf, 0);

            const dropped = Math.random() < 0.005;
            let dist = LIDAR_MAX_DIST;

            if (!dropped && hit && hit.t < LIDAR_MAX_DIST - ROBOT_RADIUS) {
                dist = hit.t + ROBOT_RADIUS;
            }

            if (dist < LIDAR_MAX_DIST) {
                dist = gaussianRandom(dist, dist * 0.01);
            }

            ranges.push(dist);
        }

        topicRef.current?.publish({
            header: { frame_id: frameId },
            angle_min: 0, angle_max: Math.PI * 2,
            angle_increment: (Math.PI * 2) / LIDAR_RAYS,
            time_increment: 0, scan_time: 1 / SENSOR_HZ,
            range_min: 0.1, range_max: LIDAR_MAX_DIST,
            ranges, intensities: [],
        });
    });

    return null;
}
