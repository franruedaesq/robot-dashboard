import type * as THREE from 'three';

// ─────────────────────────────────────────────
// World / obstacle types
// ─────────────────────────────────────────────
export type ObstacleType = 'box' | 'wall' | 'person';

export interface ObstacleConfig {
    id: string;
    type: ObstacleType;
    /** World-space centre position */
    position: [number, number, number];
    /** Y-axis rotation in radians */
    rotation: number;
    /** [width, height, depth] in metres */
    scale: [number, number, number];
    color: string;
    /** true = Rapier "dynamic" (pushable by robot), false = "fixed" */
    dynamic: boolean;
}

export interface ScenarioPreset {
    id: string;
    label: string;
    icon: string;
    obstacles: ObstacleConfig[];
}

export type RobotPose = { x: number; y: number; z: number; yaw: number };

/** Maps URDF package:// names to reachable HTTP base-URLs */
export type PackageMap = Record<string, string>;

/** Parsed URDF result: the Three.js object + auto-detected spawn-Y offset */
export interface ParsedRobot {
    root: THREE.Object3D;
    /** Y offset so the robot's lowest point sits exactly on y=0 */
    spawnY: number;
    /** Human-readable name from the URDF <robot name="…"> attribute */
    name: string;
    /** Approximate bounding size [w, h, d] in metres */
    size: [number, number, number];
    /**
     * Additional Y-axis rotation (radians) applied after the ROS→Three.js coord
     * transform so the robot's visual front aligns with the +X movement axis.
     */
    forwardAngle: number;
    /** Manual visual Y offset relative to physics collider */
    visualYOffset?: number;
}
