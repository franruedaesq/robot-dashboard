import { RigidBody } from '@react-three/rapier';
import { Grid } from '@react-three/drei';
import type { ObstacleConfig } from '../types';
import { DynamicObstacle } from './DynamicObstacle';

export function World({ obstacles = [] }: { obstacles?: ObstacleConfig[] }) {
    return (
        <group name="sim_environment">
            {/* Floor */}
            <RigidBody type="fixed" colliders="cuboid">
                <mesh receiveShadow position={[0, -0.05, 0]}>
                    <boxGeometry args={[40, 0.1, 40]} />
                    <meshStandardMaterial color="#7a7570" roughness={0.9} metalness={0.02} />
                </mesh>
            </RigidBody>

            {/* Grid overlay */}
            <Grid
                position={[0, 0, 0]} args={[40, 40]}
                cellSize={0.5} cellThickness={0.5} cellColor="#3a3a5c"
                sectionSize={2} sectionThickness={1} sectionColor="#5a5aaa"
                fadeDistance={30} infiniteGrid
            />

            {/* Dynamic / scenario obstacles */}
            {obstacles.map(obs => (
                <DynamicObstacle key={obs.id} obs={obs} />
            ))}
        </group>
    );
}
