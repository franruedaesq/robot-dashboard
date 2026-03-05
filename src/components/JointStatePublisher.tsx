import { useEffect, useRef } from 'react';
import * as ROSLIB from 'roslib';
import { useSimulationLoop } from '../contexts/HeadlessContext';
import type { ParsedRobot } from '../types';

export function JointStatePublisher({
    parsed,
    ros,
    simJointsEnabled,
    robotIndex = 0
}: {
    parsed: ParsedRobot | null;
    ros: ROSLIB.Ros | null;
    simJointsEnabled: boolean;
    robotIndex?: number;
}) {
    const topicRef = useRef<ROSLIB.Topic<any> | null>(null);
    const lastTime = useRef(0);
    const hz = 30; // 30 Hz publish rate

    useEffect(() => {
        if (!ros || !simJointsEnabled || !parsed) return;
        const topicName = robotIndex === 0 ? '/joint_states' : `/robot_${robotIndex}/joint_states`;
        topicRef.current = new ROSLIB.Topic<any>({
            ros,
            name: topicName,
            messageType: 'sensor_msgs/JointState'
        });

        return () => { topicRef.current = null; };
    }, [ros, simJointsEnabled, parsed, robotIndex]);

    useSimulationLoop(undefined, (delta) => {
        if (!simJointsEnabled || !parsed?.root || !topicRef.current) return;

        lastTime.current += delta;
        if (lastTime.current < 1 / hz) return;
        lastTime.current = 0;

        const joints = (parsed.root as any).joints as Record<string, any> | undefined;
        if (!joints) return;

        const names: string[] = [];
        const positions: number[] = [];

        for (const [name, joint] of Object.entries(joints)) {
            if (joint.jointType && joint.jointType !== 'fixed') {
                names.push(name);
                if ('angle' in joint && typeof joint.angle === 'number') {
                    positions.push(joint.angle);
                } else if ('jointValue' in joint && Array.isArray(joint.jointValue)) {
                    positions.push(joint.jointValue[0] || 0);
                } else if (typeof joint.getJointValue === 'function') {
                    positions.push(joint.getJointValue());
                } else {
                    positions.push(0);
                }
            }
        }

        if (names.length > 0) {
            topicRef.current.publish({
                header: { stamp: { sec: 0, nanosec: 0 }, frame_id: '' },
                name: names,
                position: positions,
                velocity: new Array(names.length).fill(0),
                effort: new Array(names.length).fill(0)
            });
        }
    });

    return null;
}
