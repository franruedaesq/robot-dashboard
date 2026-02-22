import { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import * as ROSLIB from 'roslib';
import * as THREE from 'three';
import type { RobotPose } from '../types';
import { SENSOR_HZ, LIDAR_RAYS, LIDAR_MAX_DIST } from '../constants';

function gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdev + mean;
}

export function SimLiDAR({ bodyRef, ros, enabled, onPoseUpdate }: {
    bodyRef: React.RefObject<RapierRigidBody | null>;
    ros: ROSLIB.Ros | null;
    enabled: boolean;
    onPoseUpdate?: (p: RobotPose) => void;
}) {
    const { scene } = useThree();
    const lastTime = useRef(0);
    const topicRef = useRef<ROSLIB.Topic<any> | null>(null);

    useEffect(() => {
        if (!ros) return;
        topicRef.current = new ROSLIB.Topic<any>({ ros, name: '/sim_scan', messageType: 'sensor_msgs/LaserScan' });
        return () => { topicRef.current = null; };
    }, [ros]);

    const raycaster = useMemo(() => new THREE.Raycaster(), []);

    useFrame(({ clock }) => {
        const body = bodyRef.current;
        if (!body) return;
        const t = body.translation();
        const r = body.rotation();
        const yaw = 2 * Math.atan2(r.y, r.w);
        onPoseUpdate?.({ x: t.x, y: t.y, z: t.z, yaw });

        if (!enabled) return;

        if (clock.elapsedTime - lastTime.current < 1 / SENSOR_HZ) return;
        lastTime.current = clock.elapsedTime;

        const origin = new THREE.Vector3(t.x, t.y + 0.18, t.z);
        const ranges: number[] = [];

        for (let i = 0; i < LIDAR_RAYS; i++) {
            const angle = yaw + (i * Math.PI * 2) / LIDAR_RAYS;
            const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

            raycaster.set(origin, dir);
            raycaster.far = LIDAR_MAX_DIST;

            // Only intersect the sim environment group to skip checking the extremely complex robot URDF model recursively 360 times
            const simEnv = scene.getObjectByName('sim_environment');
            const targetObjects = simEnv ? simEnv.children : scene.children;

            const real = raycaster.intersectObjects(targetObjects, true).filter(h => h.distance > 0.1);

            // Sensor imperfection: 0.5% chance ray gets lost and returns max dist
            const dropped = Math.random() < 0.005;

            let dist = dropped ? LIDAR_MAX_DIST : (real.length > 0 ? real[0].distance : LIDAR_MAX_DIST);

            // Sensor noise: Add 1% distance-proportional gaussian noise
            if (dist < LIDAR_MAX_DIST) {
                dist = gaussianRandom(dist, dist * 0.01);
            }

            ranges.push(dist);
        }

        topicRef.current?.publish({
            header: { frame_id: 'sim_lidar' },
            angle_min: 0, angle_max: Math.PI * 2,
            angle_increment: (Math.PI * 2) / LIDAR_RAYS,
            time_increment: 0, scan_time: 1 / SENSOR_HZ,
            range_min: 0.1, range_max: LIDAR_MAX_DIST,
            ranges, intensities: [],
        });
    });

    return null;
}
