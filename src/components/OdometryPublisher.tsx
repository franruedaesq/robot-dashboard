import { useEffect, useRef } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import * as ROSLIB from 'roslib';
import { ODOM_HZ } from '../constants';
import { useSimulationLoop } from '../contexts/HeadlessContext';

export function OdometryPublisher({ bodyRef, ros, robotIndex = 0 }: {
    bodyRef: React.RefObject<RapierRigidBody | null>;
    ros: ROSLIB.Ros | null;
    robotIndex?: number;
}) {
    const lastTime = useRef(0);
    const topicRef = useRef<ROSLIB.Topic<any> | null>(null);

    useEffect(() => {
        if (!ros) return;
        const topicName = robotIndex === 0 ? '/sim_odom' : `/robot_${robotIndex}/sim_odom`;
        const frameId = robotIndex === 0 ? 'odom' : `robot_${robotIndex}/odom`;
        const childFrameId = robotIndex === 0 ? 'base_link' : `robot_${robotIndex}/base_link`;

        topicRef.current = new ROSLIB.Topic<any>({ ros, name: topicName, messageType: 'nav_msgs/Odometry' });

        // Save these in the ref or just use them in publish directly, 
        // actually we can just store them as properties of the ref if it's a custom object.
        // Let's just create a closure for publish.
        return () => { topicRef.current = null; };
    }, [ros, robotIndex]);

    useSimulationLoop(undefined, (delta) => {
        const body = bodyRef.current;
        if (!body) return;

        // Use a simple accumulator for time since we don't have R3F clock in headless
        lastTime.current += delta;
        if (lastTime.current < 1 / ODOM_HZ) return;
        lastTime.current = 0; // Better to subtract but this is fine for simple sim

        const t = body.translation();
        const r = body.rotation();
        const lv = body.linvel();

        const frameId = robotIndex === 0 ? 'odom' : `robot_${robotIndex}/odom`;
        const childFrameId = robotIndex === 0 ? 'base_link' : `robot_${robotIndex}/base_link`;

        topicRef.current?.publish({
            header: { frame_id: frameId }, child_frame_id: childFrameId,
            pose: { pose: { position: { x: t.x, y: t.y, z: t.z }, orientation: { x: r.x, y: r.y, z: r.z, w: r.w } }, covariance: new Array(36).fill(0) },
            twist: { twist: { linear: { x: lv.x, y: lv.y, z: lv.z }, angular: { x: 0, y: 0, z: 0 } }, covariance: new Array(36).fill(0) },
        });
    });

    return null;
}
