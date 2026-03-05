import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as ROSLIB from 'roslib';
import { TrajectoryBuilder, type Trajectory } from 'ts-trajectory';
import type { ParsedRobot } from '../types';
import { getRobotConfig, updateRobotConfig } from '../utils/storage';

export function RobotArmPanel({ parsed, ros }: { parsed: ParsedRobot | null; ros: ROSLIB.Ros | null }) {
    const activeTrajectories = useRef<Map<string, { traj: Trajectory, startTime: number }>>(new Map());
    // Tracks when the user last touched each joint slider (ms timestamp)
    // Joint_states feedback is suppressed for 500ms after a manual drag
    const lastManualChange = useRef<Map<string, number>>(new Map());
    const [liveJointFeedback, setLiveJointFeedback] = useState(false);
    // Extract joints that can be controlled (revolute, continuous, prismatic)
    const joints = useMemo(() => {
        if (!parsed?.root) return [];
        const jMap = (parsed.root as any).joints as Record<string, any> | undefined;
        if (!jMap) return [];

        return Object.values(jMap)
            .filter(j => ['revolute', 'continuous', 'prismatic'].includes(j.jointType))
            .map(j => {
                let lower = -Math.PI;
                let upper = Math.PI;
                if (j.limit) {
                    lower = j.limit.lower ?? -Math.PI;
                    upper = j.limit.upper ?? Math.PI;
                }
                return {
                    name: j.name,
                    type: j.jointType,
                    lower,
                    upper
                };
            });
    }, [parsed]);

    // Local state to track slider values
    const [values, setValues] = useState<Record<string, number>>({});

    // Initialize values when joints change
    useEffect(() => {
        setValues(prev => {
            const next = { ...prev };
            let changed = false;
            const config = getRobotConfig(parsed?.name);
            const storedJoints = config.joints || {};

            joints.forEach(j => {
                const storedVal = storedJoints[j.name] ?? 0;
                if (next[j.name] !== storedVal || !(j.name in prev)) {
                    next[j.name] = storedVal;
                    changed = true;
                    // Apply visual update directly here so the model snaps to the stored position
                    const jointsMap = (parsed?.root as any)?.joints;
                    if (jointsMap && jointsMap[j.name]) {
                        jointsMap[j.name].setJointValue(storedVal);
                    }
                }
            });
            return changed ? next : prev;
        });
    }, [joints, parsed]);

    // Animation loop for smooth joint transitions
    useEffect(() => {
        let frameId: number;
        const animate = (time: number) => {
            const jointsMap = (parsed?.root as any)?.joints;

            activeTrajectories.current.forEach((data, jointName) => {
                const elapsed = (time - data.startTime) / 1000;
                const duration = data.traj.getDuration();

                if (jointsMap && jointsMap[jointName]) {
                    const pos = data.traj.sample(elapsed);
                    jointsMap[jointName].setJointValue(pos[0]);
                }

                if (elapsed >= duration) {
                    activeTrajectories.current.delete(jointName);
                    // Ensure it snaps exactly to final target when done
                    if (jointsMap && jointsMap[jointName]) {
                        const finalPos = data.traj.sample(duration);
                        jointsMap[jointName].setJointValue(finalPos[0]);
                    }
                }
            });
            frameId = requestAnimationFrame(animate);
        };
        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, [parsed]);

    // Publish all current joint states to ROS
    const publishJointStates = useCallback((currentValues: Record<string, number>) => {
        if (!ros || !joints.length) return;

        const topic = new ROSLIB.Topic({
            ros,
            name: '/joint_states',
            messageType: 'sensor_msgs/JointState'
        });

        const names = joints.map(j => j.name);
        const positions = names.map(name => currentValues[name] ?? 0);

        topic.publish({
            header: {
                stamp: {
                    secs: Math.floor(Date.now() / 1000),
                    nsecs: (Date.now() % 1000) * 1000000
                },
                frame_id: ''
            },
            name: names,
            position: positions,
            velocity: [],
            effort: []
        });
    }, [ros, joints]);

    // Publish trajectory command to ROS
    const publishTrajectory = useCallback((name: string, val: number) => {
        if (!ros) return;

        const topic = new ROSLIB.Topic({
            ros,
            name: '/joint_trajectory_controller/joint_trajectory',
            messageType: 'trajectory_msgs/JointTrajectory'
        });

        topic.publish({
            joint_names: [name],
            points: [
                {
                    positions: [val],
                    time_from_start: { secs: 0, nsecs: 500000000 } // 0.5 seconds
                }
            ]
        });
    }, [ros]);

    // Subscribe to /joint_states and update the 3D model + sliders with live robot feedback
    useEffect(() => {
        if (!ros || !parsed?.root || !liveJointFeedback) return;

        const topic = new ROSLIB.Topic({
            ros,
            name: '/joint_states',
            messageType: 'sensor_msgs/JointState'
        });

        const cb = (msg: any) => {
            const jointsMap = (parsed.root as any)?.joints;
            if (!jointsMap) return;

            const now = performance.now();
            const updates: Record<string, number> = {};

            (msg.name as string[]).forEach((name: string, i: number) => {
                if (!jointsMap[name]) return;
                // Debounce: skip if user moved this slider recently
                const lastChange = lastManualChange.current.get(name) ?? 0;
                if (now - lastChange < 500) return;

                const targetPos = msg.position[i];
                // Read current visual position (fall back to slider value)
                const currentPos = (jointsMap[name] as any).jointValue?.[0] ?? 0;

                // Route through ts-trajectory for smooth interpolation instead of snapping
                const builder = new TrajectoryBuilder();
                const traj = builder.plan([
                    { time: 0, positions: [currentPos] },
                    { time: 0.25, positions: [targetPos] } // 250ms smooth transition
                ], { interpolationType: 'cubic' });

                activeTrajectories.current.set(name, { traj, startTime: performance.now() });
                updates[name] = targetPos;
            });

            if (Object.keys(updates).length > 0) {
                setValues(prev => ({ ...prev, ...updates }));
            }
        };

        topic.subscribe(cb);
        return () => topic.unsubscribe(cb);
    }, [ros, parsed, liveJointFeedback]);

    if (!joints.length) return null;

    return (
        <div style={{ backgroundColor: '#0a0f18', padding: '12px', borderRadius: '10px', border: '1px solid #1e2a4a', color: '#cde' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '0.8rem', color: '#8cf', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🦾 Control de Articulaciones</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', cursor: 'pointer', color: liveJointFeedback ? '#2ecc71' : '#666', userSelect: 'none' }}>
                    <input
                        type="checkbox"
                        checked={liveJointFeedback}
                        onChange={e => setLiveJointFeedback(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    Live /joint_states
                </label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                {joints.map(j => (
                    <div key={j.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                        <span style={{ width: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.name}>{j.name}</span>
                        <input
                            type="range"
                            min={j.lower}
                            max={j.upper}
                            step="0.01"
                            value={values[j.name] ?? 0}
                            onChange={e => {
                                const v = parseFloat(e.target.value);
                                // Mark this joint as manually changed to suppress /joint_states feedback briefly
                                lastManualChange.current.set(j.name, performance.now());
                                setValues(prev => {
                                    const next = { ...prev, [j.name]: v };
                                    publishJointStates(next);
                                    return next;
                                });
                                publishTrajectory(j.name, v);

                                // Smooth local feedback for the UI model via ts-trajectory
                                const jointsMap = (parsed?.root as any)?.joints;
                                const currentVal = jointsMap && jointsMap[j.name]
                                    ? (jointsMap[j.name] as any).jointValue?.[0] ?? values[j.name] ?? 0
                                    : values[j.name] ?? 0;

                                const builder = new TrajectoryBuilder();
                                const traj = builder.plan([
                                    { time: 0, positions: [currentVal] },
                                    { time: 0.5, positions: [v] } // Match the 0.5s used in ROS publish
                                ], { interpolationType: 'cubic' });

                                activeTrajectories.current.set(j.name, { traj, startTime: performance.now() });

                                const config = getRobotConfig(parsed?.name);
                                const newJoints = { ...(config.joints || {}), [j.name]: v };
                                updateRobotConfig(parsed?.name, { joints: newJoints });
                            }}
                            style={{ flex: 1, cursor: 'pointer' }}
                        />
                        <span style={{ width: '40px', fontFamily: 'monospace', textAlign: 'right' }}>{(values[j.name] ?? 0).toFixed(2)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
