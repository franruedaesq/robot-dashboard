import { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import * as ROSLIB from 'roslib';
import * as THREE from 'three';
import type { RobotPose } from '../types';
import { SENSOR_HZ, LIDAR_RAYS, LIDAR_MAX_DIST } from '../constants';

export function SimLiDAR({ bodyRef, ros, enabled, onPoseUpdate }: {
    bodyRef: React.RefObject<RapierRigidBody | null>;
    ros: ROSLIB.Ros | null;
    enabled: boolean;
    onPoseUpdate?: (p: RobotPose) => void;
}) {
    const { scene } = useThree();
    const raycaster = useMemo(() => new THREE.Raycaster(), []);
    const lastTime = useRef(0);
    const hitPointsRef = useRef<THREE.Points | null>(null);
    const topicRef = useRef<ROSLIB.Topic<any> | null>(null);

    useEffect(() => {
        if (!ros) return;
        topicRef.current = new ROSLIB.Topic<any>({ ros, name: '/sim_scan', messageType: 'sensor_msgs/LaserScan' });
        return () => { topicRef.current = null; };
    }, [ros]);

    useEffect(() => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LIDAR_RAYS * 3), 3));
        const mat = new THREE.PointsMaterial({ color: '#ff4444', size: 0.05, sizeAttenuation: true });
        const pts = new THREE.Points(geo, mat);
        pts.visible = false;
        scene.add(pts);
        hitPointsRef.current = pts;
        return () => { scene.remove(pts); geo.dispose(); mat.dispose(); };
    }, [scene]);

    useFrame(({ clock }) => {
        const body = bodyRef.current;
        if (!body) return;
        const t = body.translation();
        const r = body.rotation();
        const yaw = 2 * Math.atan2(r.y, r.w);
        onPoseUpdate?.({ x: t.x, y: t.y, z: t.z, yaw });

        const pts = hitPointsRef.current;
        if (!pts) return;
        pts.visible = enabled;
        if (!enabled) return;

        if (clock.elapsedTime - lastTime.current < 1 / SENSOR_HZ) return;
        lastTime.current = clock.elapsedTime;

        const origin = new THREE.Vector3(t.x, t.y + 0.18, t.z);
        const ranges: number[] = [];
        const posAttr = pts.geometry.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < LIDAR_RAYS; i++) {
            const angle = yaw + (i * Math.PI * 2) / LIDAR_RAYS;
            const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
            raycaster.set(origin, dir);
            raycaster.far = LIDAR_MAX_DIST;
            const real = raycaster.intersectObjects(scene.children, true).filter(h => h.object !== pts);
            if (real.length > 0) {
                ranges.push(real[0].distance);
                posAttr.setXYZ(i, real[0].point.x, real[0].point.y, real[0].point.z);
            } else {
                ranges.push(LIDAR_MAX_DIST);
                posAttr.setXYZ(i, origin.x + dir.x * LIDAR_MAX_DIST, origin.y, origin.z + dir.z * LIDAR_MAX_DIST);
            }
        }
        posAttr.needsUpdate = true;
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
