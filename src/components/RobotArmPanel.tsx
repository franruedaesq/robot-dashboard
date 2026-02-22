import { useState, useEffect, useMemo, useCallback } from 'react';
import * as ROSLIB from 'roslib';
import type { ParsedRobot } from '../types';

export function RobotArmPanel({ parsed, ros }: { parsed: ParsedRobot | null; ros: ROSLIB.Ros | null }) {
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
            joints.forEach(j => {
                if (!(j.name in next)) {
                    next[j.name] = 0;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [joints]);

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

    if (!joints.length) return null;

    return (
        <div style={{ backgroundColor: '#0a0f18', padding: '12px', borderRadius: '10px', border: '1px solid #1e2a4a', color: '#cde' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#8cf', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🦾 Control de Articulaciones</h3>
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
                                setValues(prev => ({ ...prev, [j.name]: v }));
                                publishTrajectory(j.name, v);

                                // Immediate local feedback for the UI model
                                const jointsMap = (parsed?.root as any)?.joints;
                                if (jointsMap && jointsMap[j.name]) {
                                    jointsMap[j.name].setJointValue(v);
                                }
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
