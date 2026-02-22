import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import type { PackageMap, ParsedRobot } from '../types';

/**
 * Parse a URDF string into a Three.js scene graph.
 * Works for ANY robot: wheeled, arm, humanoid, drone…
 *
 * Strategy:
 *  1. Let URDFLoader build the full kinematic tree.
 *  2. Rotate -90° on X  →  converts ROS Z-up to Three.js Y-up.
 *  3. Compute the AABB bounding box and derive the spawn-Y so that the
 *     lowest point of the model sits exactly on the physics floor (y = 0).
 *  4. Apply colours from the URDF <material> definitions generically.
 */
export function parseUrdf(
    urdfText: string,
    packageMap: PackageMap,
    onLoaded: (spawnY: number, size: [number, number, number]) => void,
    forwardAngle = 0
): ParsedRobot | null {
    try {
        const manager = new THREE.LoadingManager();
        const loader = new URDFLoader(manager);
        loader.packages = packageMap;
        const root = loader.parse(urdfText);

        // 'YXZ' order: Ry(forwardAngle) * Rx(-π/2)
        // — the X rotation converts ROS Z-up → Three.js Y-up first,
        //   then Y rotates the model around the now-correct up axis.
        // Default 'XYZ' would give Rx * Ry which maps ROS Z-up to -Y (upside-down).
        root.rotation.set(-Math.PI / 2, forwardAngle, 0, 'YXZ');
        root.updateMatrixWorld(true);

        const computeMetrics = () => {
            // Primary: geometry bounding box (accurate but requires STL meshes loaded)
            const box = new THREE.Box3();
            box.setFromObject(root);

            if (isFinite(box.min.y)) {
                const s: [number, number, number] = [
                    box.max.x - box.min.x,
                    box.max.y - box.min.y,
                    box.max.z - box.min.z,
                ];
                return { y: Math.max(0, -box.min.y), s };
            }

            // Fallback: joint-origin bounding box.
            // Joint origins (Object3D world positions) are available immediately after
            // URDF parsing — before any STL mesh geometry is fetched.  For robots whose
            // root link is at the pelvis or torso (e.g. iCub), this gives the correct
            // spawnY right away, preventing the robot from spawning half-buried.
            const jointBox = new THREE.Box3();
            const _wp = new THREE.Vector3();
            root.traverse((obj: THREE.Object3D) => {
                obj.getWorldPosition(_wp);
                jointBox.expandByPoint(_wp);
            });

            if (isFinite(jointBox.min.y)) {
                const s: [number, number, number] = [
                    jointBox.max.x - jointBox.min.x,
                    jointBox.max.y - jointBox.min.y,
                    jointBox.max.z - jointBox.min.z,
                ];
                return { y: Math.max(0, -jointBox.min.y), s };
            }

            return { y: 0.05, s: [0.2, 0.2, 0.2] as [number, number, number] };
        };

        const initial = computeMetrics();

        manager.onLoad = () => {
            applyUrdfMaterialsGeneric(root, urdfText);
            const final = computeMetrics();
            onLoaded(final.y, final.s);
        };

        const nameMatch = urdfText.match(/<robot[^>]+name=["']([^"']+)["']/);
        const name = nameMatch ? nameMatch[1] : 'Unknown Robot';

        // Apply immediately for primitive shapes (boxes/cylinders) that are already there
        applyUrdfMaterialsGeneric(root, urdfText);

        return { root, spawnY: initial.y, name, size: initial.s, forwardAngle };
    } catch (e) {
        console.error('[URDF] Parse error:', e);
        return null;
    }
}

/**
 * Walk the parsed URDF object tree and apply colour + PBR properties from
 * the URDF <material> blocks. Works for any robot.
 */
export function applyUrdfMaterialsGeneric(root: THREE.Object3D, urdfText: string) {
    const colorMap: Record<string, string> = {};
    const matRe = /<material\s+name=["']([^"']+)["'][^>]*>\s*<color\s+rgba=["']([^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = matRe.exec(urdfText)) !== null) {
        const [, matName, rgba] = m;
        const [r, g, b] = rgba.trim().split(/\s+/).map(Number);
        colorMap[matName] = rgbToHex(r, g, b);
    }

    const fallback = '#555555';

    root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;

        const matName: string | undefined = obj.userData?.urdfMaterial ?? obj.userData?.material;
        const hex = (matName && colorMap[matName]) ?? fallback;

        const mat = obj.material as THREE.MeshStandardMaterial;
        mat.color.set(hex);
        mat.roughness = 0.65;
        mat.metalness = 0.20;
        mat.needsUpdate = true;

        obj.castShadow = true;
        obj.receiveShadow = true;
    });
}

export function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (v: number) =>
        Math.round(Math.min(1, Math.max(0, v)) * 255)
            .toString(16)
            .padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Find the first joint whose name contains the given keyword */
export function findJoint(joints: Record<string, any>, keyword: string): any {
    return Object.entries(joints).find(([name]) => name.includes(keyword))?.[1] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensor detection from URDF link names
// ─────────────────────────────────────────────────────────────────────────────

export interface DetectedSensor {
    /** Sensor category key */
    type: 'ft' | 'imu' | 'lidar' | 'contact' | 'camera';
    /** Human-readable label */
    label: string;
    /** Icon for display */
    icon: string;
    /** All URDF link names that matched */
    links: string[];
}

const SENSOR_CATEGORIES: Array<Omit<DetectedSensor, 'links'> & { patterns: RegExp[] }> = [
    { type: 'ft', label: 'Force-Torque', icon: '⚖️', patterns: [/_ft_sensor/i, /force[_-]?torque/i] },
    { type: 'imu', label: 'IMU / Gyro', icon: '🌀', patterns: [/_gyro_/i, /\bimu\b/i, /imu_link/i] },
    { type: 'lidar', label: 'LiDAR', icon: '📡', patterns: [/base_scan/i, /\blidar\b/i, /laser_scan/i, /\blaser\b/i] },
    { type: 'contact', label: 'Contact/Tactile', icon: '👆', patterns: [/_contact\b/i, /tactile/i, /touch/i] },
    { type: 'camera', label: 'Camera', icon: '📷', patterns: [/\bcamera\b/i, /\bcam\b/i] },
];

/**
 * Scan all `<link name="…">` entries in a URDF string and group them by
 * sensor category based on naming conventions.
 * Returns only categories that have at least one matching link.
 */
export function parseSensors(urdfText: string): DetectedSensor[] {
    const linkRe = /<link\s+name=["']([^"']+)["']/g;
    const allLinks: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(urdfText)) !== null) {
        allLinks.push(m[1]);
    }

    const results: DetectedSensor[] = [];
    for (const { type, label, icon, patterns } of SENSOR_CATEGORIES) {
        const matched = allLinks.filter(name => patterns.some(p => p.test(name)));
        if (matched.length > 0) {
            results.push({ type, label, icon, links: matched });
        }
    }
    return results;
}
