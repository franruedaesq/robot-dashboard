import { useState, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ObstacleType } from '../types';
import { SPAWN_Y, DEFAULT_SCALE, DEFAULT_COLOR } from '../scenarios/presets';

// ─────────────────────────────────────────────
// Ghost mesh — semi-transparent preview
// ─────────────────────────────────────────────
function GhostMesh({ type, position, rotation }: {
    type: ObstacleType;
    position: THREE.Vector3;
    rotation: number;
}) {
    const scale = DEFAULT_SCALE[type];
    const color = DEFAULT_COLOR[type];
    const pos = position.toArray() as [number, number, number];

    if (type === 'person') {
        return (
            <group position={pos} rotation={[0, rotation, 0]}>
                <mesh>
                    <cylinderGeometry args={[0.22, 0.22, 1.12, 10]} />
                    <meshStandardMaterial color={color} transparent opacity={0.45} depthWrite={false} />
                </mesh>
                <mesh position={[0, 0.82, 0]}>
                    <sphereGeometry args={[0.22, 10, 10]} />
                    <meshStandardMaterial color="#f5cba7" transparent opacity={0.45} depthWrite={false} />
                </mesh>
            </group>
        );
    }

    return (
        <mesh position={pos} rotation={[0, rotation, 0]}>
            <boxGeometry args={scale} />
            <meshStandardMaterial color={color} transparent opacity={0.45} depthWrite={false} />
        </mesh>
    );
}

// ─────────────────────────────────────────────
// PlacementOverlay — lives inside the Canvas
// ─────────────────────────────────────────────
export function PlacementOverlay({ active, type, rotation, onPlace }: {
    active: boolean;
    type: ObstacleType | null;
    rotation: number;
    onPlace: (pos: THREE.Vector3) => void;
}) {
    const { gl, camera } = useThree();
    const [ghostPos, setGhostPos] = useState<THREE.Vector3 | null>(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const floorPlane   = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const onPlaceRef   = useRef(onPlace);
    useEffect(() => { onPlaceRef.current = onPlace; });

    // Drag-detection: ignore a pointerup that followed a drag
    const isDragging = useRef(false);
    const pointerDownPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!active) { setGhostPos(null); return; }

        const canvas = gl.domElement;

        const getFloorPos = (clientX: number, clientY: number): THREE.Vector3 | null => {
            const rect = canvas.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((clientX - rect.left) / rect.width)  *  2 - 1,
                -((clientY - rect.top)  / rect.height) * 2 + 1,
            );
            raycasterRef.current.setFromCamera(mouse, camera);
            const target = new THREE.Vector3();
            const hit = raycasterRef.current.ray.intersectPlane(floorPlane.current, target);
            return hit ? target : null;
        };

        const onPointerDown = (e: PointerEvent) => {
            isDragging.current = false;
            pointerDownPos.current = { x: e.clientX, y: e.clientY };
        };

        const onPointerMove = (e: PointerEvent) => {
            const dx = e.clientX - pointerDownPos.current.x;
            const dy = e.clientY - pointerDownPos.current.y;
            if (Math.sqrt(dx * dx + dy * dy) > 5) isDragging.current = true;

            const pos = getFloorPos(e.clientX, e.clientY);
            if (pos && type) {
                pos.y = SPAWN_Y[type];
                setGhostPos(pos.clone());
            }
        };

        const onClick = (e: MouseEvent) => {
            if (isDragging.current) return; // was a drag, not a click
            const pos = getFloorPos(e.clientX, e.clientY);
            if (pos && type) {
                pos.y = SPAWN_Y[type];
                onPlaceRef.current(pos);
            }
        };

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('click',       onClick);
        return () => {
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('click',       onClick);
        };
    }, [active, camera, gl, type]);

    if (!active || !type || !ghostPos) return null;

    return <GhostMesh type={type} position={ghostPos} rotation={rotation} />;
}
