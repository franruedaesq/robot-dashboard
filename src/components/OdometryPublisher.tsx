import { useEffect, useRef } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import * as ROSLIB from 'roslib';
import { ODOM_HZ } from '../constants';
import { useSimulationLoop } from '../contexts/HeadlessContext';
import { useTFEngine } from '../contexts/TFEngineContext';

export function OdometryPublisher({ bodyRef, ros, robotIndex = 0 }: {
    bodyRef: React.RefObject<RapierRigidBody | null>;
    ros: ROSLIB.Ros | null;
    robotIndex?: number;
}) {
    const tfTree = useTFEngine();
    const lastTime = useRef(0);
    const topicRef = useRef<ROSLIB.Topic<any> | null>(null);

    useEffect(() => {
        if (!ros) return;
        const topicName = robotIndex === 0 ? '/sim_odom' : `/robot_${robotIndex}/sim_odom`;
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

        const frameId = robotIndex === 0 ? 'odom' : `robot_${robotIndex}/odom`;
        const childFrameId = robotIndex === 0 ? 'base_link' : `robot_${robotIndex}/base_link`;

        let t = { x: 0, y: 0, z: 0 };
        let r = { x: 0, y: 0, z: 0, w: 1 };

        if (tfTree.hasFrame(childFrameId)) {
            const transform = tfTree.getTransformAt("world", childFrameId, Date.now());
            t = transform.translation;
            r = transform.rotation;
        } else {
            // Fallback just in case
            t = body.translation();
            r = body.rotation();
        }

        const lv = body.linvel();

        topicRef.current?.publish({
            header: { frame_id: frameId }, child_frame_id: childFrameId,
            pose: { pose: { position: { x: t.x, y: t.y, z: t.z }, orientation: { x: r.x, y: r.y, z: r.z, w: r.w } }, covariance: new Array(36).fill(0) },
            twist: { twist: { linear: { x: lv.x, y: lv.y, z: lv.z }, angular: { x: 0, y: 0, z: 0 } }, covariance: new Array(36).fill(0) },
        });
    });

    return null;
}
