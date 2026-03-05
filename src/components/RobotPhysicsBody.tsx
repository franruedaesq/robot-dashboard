import { useRef, useCallback, forwardRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

import { useSimulationLoop } from '../contexts/HeadlessContext';
import { useServerPhysics } from '../contexts/ServerPhysicsContext';
import * as ROSLIB from 'roslib';
import * as THREE from 'three';
import type { ParsedRobot, RobotPose } from '../types';
import { findJoint } from '../utils/urdf';
import { OdometryPublisher } from './OdometryPublisher';
import { SimLiDAR } from './SimLiDAR';
import { SimCamera } from './SimCamera';
import { Transform, Vec3, Quaternion } from '@tf-engine/core';
import { useTFEngine } from '../contexts/TFEngineContext';

// ── Compatible pose ref interface ────────────────────────────────────────────
// Mimics the subset of RapierRigidBody that OdometryPublisher / SimLiDAR /
// SimCamera read from, but backed by the server-provided physics snapshot.
export interface PoseRef {
    translation: () => { x: number; y: number; z: number };
    rotation: () => { x: number; y: number; z: number; w: number };
    linvel: () => { x: number; y: number; z: number };
}

export const RobotPhysicsBody = forwardRef<THREE.Group, {
    parsed: (ParsedRobot & { visualYOffset?: number }) | null;
    velocity: { linear: number; angular: number };
    ros: ROSLIB.Ros | null;
    simLidarEnabled: boolean;
    simCamEnabled: boolean;
    simJointsEnabled: boolean;
    thumbnailCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    camHttpEndpoint?: string;
    expandedCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
    onPoseUpdate?: (p: RobotPose) => void;
    robotIndex?: number;
}>(({ parsed, velocity, ros, simLidarEnabled, simCamEnabled, simJointsEnabled, thumbnailCanvasRef, camHttpEndpoint, expandedCanvasRef, onPoseUpdate, robotIndex = 0 }, ref) => {
    const groupRef = useRef<THREE.Group>(null);
    const wheelAngleRef = useRef({ left: 0, right: 0 });
    const gaitPhaseRef = useRef(0);
    const tfTree = useTFEngine();
    const { getEntry } = useServerPhysics();

    // Previous position for computing velocity estimate
    const prevPosRef = useRef<[number, number, number]>([0, 0.3, 0]);

    const setRef = useCallback((group: THREE.Group | null) => {
        (groupRef as React.RefObject<THREE.Group | null>).current = group;
        if (typeof ref === 'function') ref(group);
        else if (ref) (ref as React.RefObject<THREE.Group | null>).current = group;
    }, [ref]);

    // ── Pose ref compatible with OdometryPublisher / SimLiDAR / SimCamera ──
    const poseRef = useRef<PoseRef>({
        translation: () => ({ x: 0, y: 0.3, z: 0 }),
        rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
        linvel: () => ({ x: 0, y: 0, z: 0 }),
    });

    // ── Read server snapshot and update visuals each frame ─────────────────
    useFrame((_, delta) => {
        const entry = getEntry('robot');
        if (!entry) return;

        const [px, py, pz] = entry.position;
        const [qx, qy, qz, qw] = entry.rotation;

        // Update the Three.js group to match server position
        const group = groupRef.current;
        if (group) {
            group.position.set(px, py, pz);
            group.quaternion.set(qx, qy, qz, qw);
        }

        // Estimate linear velocity from position delta
        const [ppx, ppy, ppz] = prevPosRef.current;
        const dt = Math.max(delta, 1 / 120); // avoid div-by-zero
        const lvx = (px - ppx) / dt;
        const lvy = (py - ppy) / dt;
        const lvz = (pz - ppz) / dt;
        prevPosRef.current = [px, py, pz];

        // Update the compatible pose ref for child components
        poseRef.current = {
            translation: () => ({ x: px, y: py, z: pz }),
            rotation: () => ({ x: qx, y: qy, z: qz, w: qw }),
            linvel: () => ({ x: lvx, y: lvy, z: lvz }),
        };

        // Update tf-engine with the robot's base_link pose
        const frameId = `robot_${robotIndex}/base_link`;
        if (!tfTree.hasFrame(frameId)) {
            tfTree.addFrame(frameId, "world");
        }

        tfTree.setTransform(
            frameId,
            new Transform(
                new Vec3(px, py, pz),
                new Quaternion(qx, qy, qz, qw)
            ),
            Date.now()
        );
    });

    // ── Joint animation (runs every frame, driven by velocity prop) ───────
    useSimulationLoop((delta) => {
        if (!parsed?.root) return;
        const joints = (parsed.root as any).joints as Record<string, any> | undefined;
        if (!joints) return;

        // ── Wheeled robots (TurtleBot3, etc.) ────────────────────────────────
        const leftWheel = findJoint(joints, 'wheel_left');
        const rightWheel = findJoint(joints, 'wheel_right');
        if (leftWheel && rightWheel) {
            const WHEEL_RADIUS = 0.033; // metres (TurtleBot3 Burger/Waffle)
            const WHEEL_BASE = 0.16;  // metres between wheel centres (Burger)
            const leftSpeed = (velocity.linear - velocity.angular * WHEEL_BASE / 2) / WHEEL_RADIUS;
            const rightSpeed = (velocity.linear + velocity.angular * WHEEL_BASE / 2) / WHEEL_RADIUS;
            wheelAngleRef.current.left += leftSpeed * delta;
            wheelAngleRef.current.right += rightSpeed * delta;
            leftWheel.setJointValue(wheelAngleRef.current.left);
            rightWheel.setJointValue(wheelAngleRef.current.right);
        }

        // ── Legged robots (iCub, etc.) ────────────────────────────────────────
        const lHipPitch = findJoint(joints, 'l_hip_pitch');
        const rHipPitch = findJoint(joints, 'r_hip_pitch');
        if (lHipPitch && rHipPitch) {
            const isMoving = Math.abs(velocity.linear) > 0.01 || Math.abs(velocity.angular) > 0.01;
            const speed = Math.abs(velocity.linear) + Math.abs(velocity.angular) * 0.3;
            if (isMoving) gaitPhaseRef.current += speed * delta * 4.0;
            const phase = gaitPhaseRef.current;
            const amp = isMoving ? 0.3 : 0.0;

            lHipPitch.setJointValue(amp * Math.sin(phase));
            rHipPitch.setJointValue(amp * Math.sin(phase + Math.PI));

            const lKnee = findJoint(joints, 'l_knee');
            const rKnee = findJoint(joints, 'r_knee');
            if (lKnee) lKnee.setJointValue(Math.max(0, amp * 0.5 * Math.sin(phase + Math.PI / 4)));
            if (rKnee) rKnee.setJointValue(Math.max(0, amp * 0.5 * Math.sin(phase + Math.PI + Math.PI / 4)));

            const lAnkle = findJoint(joints, 'l_ankle_pitch');
            const rAnkle = findJoint(joints, 'r_ankle_pitch');
            if (lAnkle) lAnkle.setJointValue(-amp * 0.3 * Math.sin(phase));
            if (rAnkle) rAnkle.setJointValue(-amp * 0.3 * Math.sin(phase + Math.PI));

            // Arms swing counter-phase to legs for natural balance
            const lShoulder = findJoint(joints, 'l_shoulder_pitch');
            const rShoulder = findJoint(joints, 'r_shoulder_pitch');
            if (lShoulder) lShoulder.setJointValue(amp * 0.5 * Math.sin(phase + Math.PI));
            if (rShoulder) rShoulder.setJointValue(amp * 0.5 * Math.sin(phase));
        }
    });

    // ── Subscribe to /joint_states ──────────────────────────────────────────
    useEffect(() => {
        if (!ros || !parsed?.root || !simJointsEnabled) return;
        const root = parsed.root;
        const topicName = robotIndex === 0 ? '/joint_states' : `/robot_${robotIndex}/joint_states`;
        const topic = new ROSLIB.Topic({
            ros,
            name: topicName,
            messageType: 'sensor_msgs/JointState',
        });
        const cb = (msg: any) => {
            const joints = (root as any).joints as Record<string, any> | undefined;
            if (!joints || !msg.name || !msg.position) return;
            msg.name.forEach((name: string, i: number) => {
                const j = joints[name];
                if (j && typeof j.setJointValue === 'function') {
                    j.setJointValue(msg.position[i]);
                }
            });
        };
        topic.subscribe(cb);
        return () => topic.unsubscribe(cb);
    }, [ros, parsed?.root, simJointsEnabled]);

    // Spawn position matching the server's initial robot position
    const spawnY = Math.max(0.3, parsed?.spawnY ?? 0.5);

    return (
        <>
            <group
                ref={setRef as any}
                position={[0, spawnY, robotIndex * 1.5]}
            >
                {parsed ? (
                    <primitive object={parsed.root} dispose={null} position={[0, parsed.visualYOffset ?? 0, 0]} />
                ) : (
                    <mesh castShadow>
                        <boxGeometry args={[0.3, 0.2, 0.3]} />
                        <meshStandardMaterial color="#3498db" wireframe />
                    </mesh>
                )}
            </group>
            <OdometryPublisher bodyRef={poseRef as any} ros={ros} robotIndex={robotIndex} />
            <SimLiDAR bodyRef={poseRef as any} ros={ros} enabled={simLidarEnabled} onPoseUpdate={onPoseUpdate} robotIndex={robotIndex} />
            <SimCamera bodyRef={poseRef as any} ros={ros} enabled={simCamEnabled} thumbnailCanvasRef={thumbnailCanvasRef} httpEndpoint={camHttpEndpoint} expandedCanvasRef={expandedCanvasRef} />
        </>
    );
});
RobotPhysicsBody.displayName = 'RobotPhysicsBody';
