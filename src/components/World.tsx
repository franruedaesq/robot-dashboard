import { Grid } from '@react-three/drei';
import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useSpatialEngineContext } from '../contexts/SpatialEngineContext';
import { ThreeSynchronizer } from '@spatial-engine/three';
import type { ObstacleConfig } from '../types';
import { DynamicObstacle } from './DynamicObstacle';

export function World({ obstacles = [] }: { obstacles?: ObstacleConfig[] }) {
    const floorRef = useRef<THREE.Mesh>(null);
    const { octree, aabbPool } = useSpatialEngineContext();
    const syncer = useRef<ThreeSynchronizer | null>(null);

    useEffect(() => {
        if (!floorRef.current) return;
        syncer.current = new ThreeSynchronizer(floorRef.current, octree, aabbPool);
        syncer.current.sync();
        return () => {
            if (syncer.current && typeof syncer.current.dispose === 'function') {
                syncer.current.dispose();
            }
            syncer.current = null;
        };
    }, [octree, aabbPool]);

    return (
        <group name="sim_environment">
            {/* Floor — visual only, physics is on the server */}
            <mesh ref={floorRef} receiveShadow position={[0, -0.05, 0]}>
                <boxGeometry args={[40, 0.1, 40]} />
                <meshStandardMaterial color="#7a7570" roughness={0.9} metalness={0.02} />
            </mesh>

            {/* Grid overlay */}
            <Grid
                position={[0, 0, 0]} args={[40, 40]}
                cellSize={0.5} cellThickness={0.5} cellColor="#3a3a5c"
                sectionSize={2} sectionThickness={1} sectionColor="#5a5aaa"
                fadeDistance={30} infiniteGrid
            />

            {/* Dynamic / scenario obstacles (visual only) */}
            {obstacles.map(obs => (
                <DynamicObstacle key={obs.id} obs={obs} />
            ))}
        </group>
    );
}
