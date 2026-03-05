import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useSpatialEngineContext } from '../contexts/SpatialEngineContext';
import { ThreeSynchronizer } from '@spatial-engine/three';
import { useFrame } from '@react-three/fiber';
import type { ObstacleConfig } from '../types';

/** Renders a single obstacle — visual only, no physics (server-authoritative) */
export function DynamicObstacle({ obs }: { obs: ObstacleConfig }) {
    const { type, position, rotation, scale, color, dynamic } = obs;

    const meshRef = useRef<THREE.Mesh>(null);
    const groupRef = useRef<THREE.Group>(null);
    const { octree, aabbPool } = useSpatialEngineContext();
    const syncer = useRef<ThreeSynchronizer | null>(null);

    useEffect(() => {
        const target = meshRef.current || groupRef.current;
        if (!target) return;
        syncer.current = new ThreeSynchronizer(target, octree, aabbPool);
        syncer.current.sync();
        return () => {
            if (syncer.current && typeof syncer.current.dispose === 'function') {
                syncer.current.dispose();
            }
            syncer.current = null;
        };
    }, [octree, aabbPool]);

    useFrame(() => {
        if (dynamic && syncer.current) {
            syncer.current.sync();
        }
    });

    if (type === 'box' || type === 'wall') {
        return (
            <group
                key={obs.id}
                position={position}
                rotation={[0, rotation, 0]}
            >
                <mesh ref={meshRef} castShadow receiveShadow>
                    <boxGeometry args={scale} />
                    <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
                </mesh>
            </group>
        );
    }

    // ── Person ───────────────────────────────────────────────────────────────
    return (
        <group
            key={obs.id}
            position={position}
            rotation={[0, rotation, 0]}
        >
            <group ref={groupRef}>
                {/* Body — cylinder */}
                <mesh castShadow position={[0, 0, 0]}>
                    <cylinderGeometry args={[0.22, 0.22, 1.12, 10]} />
                    <meshStandardMaterial color={color} roughness={0.8} />
                </mesh>

                {/* Head — sphere sitting above body */}
                <mesh castShadow position={[0, 0.82, 0]}>
                    <sphereGeometry args={[0.22, 10, 10]} />
                    <meshStandardMaterial color="#f5cba7" roughness={0.8} />
                </mesh>
            </group>
        </group>
    );
}
