import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import type { ObstacleConfig } from '../types';

/** Renders a single obstacle with physics and visuals */
export function DynamicObstacle({ obs }: { obs: ObstacleConfig }) {
    const { type, position, rotation, scale, color, dynamic } = obs;
    const bodyType = dynamic ? 'dynamic' : 'fixed';

    if (type === 'box' || type === 'wall') {
        return (
            <RigidBody
                key={obs.id}
                type={bodyType}
                colliders="cuboid"
                position={position}
                rotation={[0, rotation, 0]}
            >
                <mesh castShadow receiveShadow>
                    <boxGeometry args={scale} />
                    <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
                </mesh>
            </RigidBody>
        );
    }

    // ── Person ───────────────────────────────────────────────────────────────
    // CapsuleCollider: halfHeight=0.56m, radius=0.22m → total 1.56m
    // RigidBody centre at spawn Y = 0.78m (bottom of capsule touches y=0)
    return (
        <RigidBody
            key={obs.id}
            type={bodyType}
            colliders={false}
            position={position}
            rotation={[0, rotation, 0]}
            linearDamping={0.5}
            angularDamping={0.3}
        >
            <CapsuleCollider args={[0.56, 0.22]} />

            {/* Body — cylinder that fills the capsule cylinder section */}
            <mesh castShadow position={[0, 0, 0]}>
                <cylinderGeometry args={[0.22, 0.22, 1.12, 10]} />
                <meshStandardMaterial color={color} roughness={0.8} />
            </mesh>

            {/* Head — sphere sitting above body */}
            <mesh castShadow position={[0, 0.82, 0]}>
                <sphereGeometry args={[0.22, 10, 10]} />
                <meshStandardMaterial color="#f5cba7" roughness={0.8} />
            </mesh>
        </RigidBody>
    );
}
