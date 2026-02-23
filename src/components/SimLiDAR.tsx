import { useEffect, useRef } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import { useRapier } from '@react-three/rapier';
import * as ROSLIB from 'roslib';
import type { RobotPose } from '../types';
import { SENSOR_HZ, LIDAR_RAYS, LIDAR_MAX_DIST } from '../constants';
import { useSimulationLoop } from '../contexts/HeadlessContext';

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
    const { world, rapier } = useRapier();
    const lastTime = useRef(0);
    const topicRef = useRef<ROSLIB.Topic<any> | null>(null);

    useEffect(() => {
        if (!ros) return;
        const topicName = robotIndex === 0 ? '/sim_scan' : `/robot_${robotIndex}/sim_scan`;
        topicRef.current = new ROSLIB.Topic<any>({ ros, name: topicName, messageType: 'sensor_msgs/LaserScan' });
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

        for (let i = 0; i < LIDAR_RAYS; i++) {
            const angle = yaw + (i * Math.PI * 2) / LIDAR_RAYS;
            const dirX = Math.sin(angle);
            const dirZ = Math.cos(angle);

            const originObj = { x: t.x + dirX * ROBOT_RADIUS, y: t.y + 0.18, z: t.z + dirZ * ROBOT_RADIUS };
            const dirObj = { x: dirX, y: 0, z: dirZ };
            const ray = new rapier.Ray(originObj, dirObj);

            // solid = true means we hit inside of colliders.
            const hit = world.castRay(ray, LIDAR_MAX_DIST - ROBOT_RADIUS, true, undefined, undefined, undefined, undefined);

            const dropped = Math.random() < 0.005;
            let dist = LIDAR_MAX_DIST;

            if (!dropped && hit) {
                const rawToi = (hit as any).toi ?? (hit as any).timeOfImpact;
                if (rawToi != null) {
                    dist = rawToi + ROBOT_RADIUS;
                }
            }

            if (dist < LIDAR_MAX_DIST) {
                dist = gaussianRandom(dist, dist * 0.01);
            }

            ranges.push(dist);
        }

        const frameId = robotIndex === 0 ? 'sim_lidar' : `robot_${robotIndex}/sim_lidar`;

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
