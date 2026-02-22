import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import * as ROSLIB from 'roslib';
import { ODOM_HZ } from '../constants';

export function OdometryPublisher({ bodyRef, ros }: {
    bodyRef: React.RefObject<RapierRigidBody | null>;
    ros: ROSLIB.Ros | null;
}) {
    const lastTime = useRef(0);
    const topicRef = useRef<ROSLIB.Topic<any> | null>(null);

    useEffect(() => {
        if (!ros) return;
        topicRef.current = new ROSLIB.Topic<any>({ ros, name: '/sim_odom', messageType: 'nav_msgs/Odometry' });
        return () => { topicRef.current = null; };
    }, [ros]);

    useFrame(({ clock }) => {
        const body = bodyRef.current;
        if (!body) return;
        if (clock.elapsedTime - lastTime.current < 1 / ODOM_HZ) return;
        lastTime.current = clock.elapsedTime;
        const t = body.translation();
        const r = body.rotation();
        const lv = body.linvel();
        topicRef.current?.publish({
            header: { frame_id: 'odom' }, child_frame_id: 'base_link',
            pose: { pose: { position: { x: t.x, y: t.y, z: t.z }, orientation: { x: r.x, y: r.y, z: r.z, w: r.w } }, covariance: new Array(36).fill(0) },
            twist: { twist: { linear: { x: lv.x, y: lv.y, z: lv.z }, angular: { x: 0, y: 0, z: 0 } }, covariance: new Array(36).fill(0) },
        });
    });

    return null;
}
