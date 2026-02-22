import { useRef, useCallback, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as ROSLIB from 'roslib';
import type { ParsedRobot, RobotPose } from '../types';
import { findJoint } from '../utils/urdf';
import { OdometryPublisher } from './OdometryPublisher';
import { SimLiDAR } from './SimLiDAR';
import { SimCamera } from './SimCamera';

export const RobotPhysicsBody = forwardRef<RapierRigidBody, {
    parsed: (ParsedRobot & { visualYOffset?: number }) | null;
    velocity: { linear: number; angular: number };
    ros: ROSLIB.Ros | null;
    simLidarEnabled: boolean;
    simCamEnabled: boolean;
    thumbnailCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    camHttpEndpoint?: string;
    expandedCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
    onPoseUpdate: (p: RobotPose) => void;
}>(({ parsed, velocity, ros, simLidarEnabled, simCamEnabled, thumbnailCanvasRef, camHttpEndpoint, expandedCanvasRef, onPoseUpdate }, ref) => {
    const internalRef = useRef<RapierRigidBody>(null);
    const wheelAngleRef = useRef({ left: 0, right: 0 });
    const gaitPhaseRef = useRef(0);

    const setRef = useCallback((body: RapierRigidBody | null) => {
        (internalRef as React.RefObject<RapierRigidBody | null>).current = body;
        if (typeof ref === 'function') ref(body);
        else if (ref) (ref as React.RefObject<RapierRigidBody | null>).current = body;
    }, [ref]);

    useFrame((_, delta) => {
        const body = internalRef.current;
        if (!body) return;

        // 1. Physics control — let Rapier own Y (gravity + floor contact)
        body.setAngvel({ x: 0, y: velocity.angular, z: 0 }, true);
        const r = body.rotation();
        const yaw = 2 * Math.atan2(r.y, r.w);
        const vx = Math.cos(yaw) * velocity.linear;
        const vz = -Math.sin(yaw) * velocity.linear;
        body.setLinvel({ x: vx, y: body.linvel().y, z: vz }, true);

        // 2. Joint animation
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

    // Spawn slightly above the floor so no initial collider overlap.
    // Gravity (re-enabled) brings the robot down to the floor naturally.
    const spawnY = Math.max(0.3, parsed?.spawnY ?? 0.5);

    return (
        <>
            <RigidBody
                ref={setRef as any}
                colliders="cuboid"
                type="dynamic"
                enabledRotations={[false, true, false]}
                linearDamping={4}
                angularDamping={4}
                position={[0, spawnY, 0]}
            >
                {parsed ? (
                    <primitive object={parsed.root} dispose={null} position={[0, parsed.visualYOffset ?? 0, 0]} />
                ) : (
                    <mesh castShadow>
                        <boxGeometry args={[0.3, 0.2, 0.3]} />
                        <meshStandardMaterial color="#3498db" wireframe />
                    </mesh>
                )}
            </RigidBody>
            <OdometryPublisher bodyRef={internalRef} ros={ros} />
            <SimLiDAR bodyRef={internalRef} ros={ros} enabled={simLidarEnabled} onPoseUpdate={onPoseUpdate} />
            <SimCamera bodyRef={internalRef} ros={ros} enabled={simCamEnabled} thumbnailCanvasRef={thumbnailCanvasRef} httpEndpoint={camHttpEndpoint} expandedCanvasRef={expandedCanvasRef} />
        </>
    );
});
RobotPhysicsBody.displayName = 'RobotPhysicsBody';
