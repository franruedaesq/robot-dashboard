import type { ObstacleConfig, ObstacleType, ScenarioPreset } from '../types';

// ─────────────────────────────────────────────
// Default dimensions & colours per type
//
// Sizes are proportionate to real robot test labs:
//   TurtleBot3 Burger ≈ 0.14 × 0.18 × 0.19 m
//   iCub              ≈ 0.30 × 0.30 × 1.00 m
// ─────────────────────────────────────────────
export const SPAWN_Y: Record<ObstacleType, number> = {
    box: 0.25,  // box height 0.5 m → centre at 0.25
    wall: 1.00,  // wall height 2 m  → centre at 1.00
    person: 0.78,  // capsule (halfH=0.56, r=0.22) → bottom at floor
};

export const DEFAULT_SCALE: Record<ObstacleType, [number, number, number]> = {
    box: [0.5, 0.5, 0.5],   // small cardboard box (~3× TurtleBot3 width)
    wall: [0.3, 2.0, 3.0],   // wall segment, 3 m long
    person: [0.44, 1.6, 0.44],
};

export const DEFAULT_COLOR: Record<ObstacleType, string> = {
    box: '#e67e22',  // orange — dynamic crates
    wall: '#4a6fa5',  // steel blue — structure
    person: '#e74c3c',  // red — people
};

// ─────────────────────────────────────────────
// Helper builders
// ─────────────────────────────────────────────
let _idCtr = 0;
function mkId() { return `preset-${++_idCtr}`; }

function box(
    x: number, z: number,
    opts: Partial<Pick<ObstacleConfig, 'scale' | 'color' | 'dynamic' | 'rotation'>> = {}
): ObstacleConfig {
    const scale = opts.scale ?? DEFAULT_SCALE.box;
    return {
        id: mkId(), type: 'box',
        position: [x, scale[1] / 2, z],
        rotation: opts.rotation ?? 0,
        scale,
        color: opts.color ?? DEFAULT_COLOR.box,
        dynamic: opts.dynamic ?? true,
    };
}

function wall(
    x: number, z: number,
    scale: [number, number, number],
    opts: Partial<Pick<ObstacleConfig, 'color' | 'dynamic' | 'rotation'>> = {}
): ObstacleConfig {
    return {
        id: mkId(), type: 'wall',
        position: [x, scale[1] / 2, z],
        rotation: opts.rotation ?? 0,
        scale,
        color: opts.color ?? DEFAULT_COLOR.wall,
        dynamic: opts.dynamic ?? false,
    };
}

export function person(x: number, z: number): ObstacleConfig {
    return {
        id: mkId(), type: 'person',
        position: [x, SPAWN_Y.person, z],
        rotation: Math.random() * Math.PI * 2,
        scale: DEFAULT_SCALE.person,
        color: DEFAULT_COLOR.person,
        dynamic: true,
    };
}

// ─────────────────────────────────────────────
// Scenario: Warehouse  (12 m × 10 m)
//
// 0.5 m crates — ≈3× TurtleBot3 width, ≈0.5× iCub height.
// Two shelf aisles with stacked crates, 4 pillars, loading divider.
// ─────────────────────────────────────────────
const WAREHOUSE_GREY = '#7f8c8d';
const WAREHOUSE_CRATE = '#c0392b';

const warehouseObstacles: ObstacleConfig[] = [
    // ── Perimeter walls (fixed) ────────────────────────────────────────────
    wall(0, -5, [12.6, 2.0, 0.3], { color: WAREHOUSE_GREY }),  // back
    wall(0, 5, [12.6, 2.0, 0.3], { color: WAREHOUSE_GREY }),  // front
    wall(-6, 0, [0.3, 2.0, 10.0], { color: WAREHOUSE_GREY }),  // left
    wall(6, 0, [0.3, 2.0, 10.0], { color: WAREHOUSE_GREY }),  // right

    // ── Shelf row A (dynamic crates, orange) — z=-2 ────────────────────────
    box(-4, -2), box(-2, -2), box(0, -2), box(2, -2),
    // Second layer on first two stacks
    box(-4, -2), box(-2, -2),

    // ── Shelf row B (dynamic crates, red) — z=2 ───────────────────────────
    box(-4, 2, { color: WAREHOUSE_CRATE }),
    box(-2, 2, { color: WAREHOUSE_CRATE }),
    box(0, 2, { color: WAREHOUSE_CRATE }),
    box(2, 2, { color: WAREHOUSE_CRATE }),

    // ── Support pillars (fixed) ────────────────────────────────────────────
    wall(-5, -2, [0.3, 2.5, 0.3], { color: WAREHOUSE_GREY }),
    wall(3, -2, [0.3, 2.5, 0.3], { color: WAREHOUSE_GREY }),
    wall(-5, 2, [0.3, 2.5, 0.3], { color: WAREHOUSE_GREY }),
    wall(3, 2, [0.3, 2.5, 0.3], { color: WAREHOUSE_GREY }),

    // ── Loading area divider (fixed) ───────────────────────────────────────
    wall(5, 0, [0.3, 2.0, 8.0], { color: WAREHOUSE_GREY }),
];

// ─────────────────────────────────────────────
// Scenario: Narrow Corridor
//
// Clear width: 1.2 m (walls centred at ±0.75 m, 0.3 m thick).
// Four staggered 0.5 m crates force the robot to weave.
// ─────────────────────────────────────────────
const corridorObstacles: ObstacleConfig[] = [
    // ── Side walls ─────────────────────────────────────────────────────────
    wall(0.75, 0, [0.3, 2.0, 8.0], { color: '#2c3e50' }),   // right wall
    wall(-0.75, 0, [0.3, 2.0, 8.0], { color: '#2c3e50' }),   // left wall
    // End caps
    wall(0, -4, [1.8, 2.0, 0.3], { color: '#2c3e50' }),
    wall(0, 4, [1.8, 2.0, 0.3], { color: '#2c3e50' }),

    // ── Staggered obstacles ────────────────────────────────────────────────
    box(-0.15, -2.5),
    box(0.15, -0.8),
    box(-0.15, 1.0),
    box(0.15, 2.8),
];

// ─────────────────────────────────────────────
// Scenario: Maze  (10 m × 10 m)
//
// Inner walls scaled from the original 18 m version (factor ≈0.556).
// Maze corridors are ≈1.5–2 m wide.
// ─────────────────────────────────────────────
const MAZE_COLOR = '#1a5276';

const mazeObstacles: ObstacleConfig[] = [
    // ── Outer perimeter ────────────────────────────────────────────────────
    wall(0, -5, [10.6, 2.5, 0.3], { color: MAZE_COLOR }),  // top
    wall(0, 5, [10.6, 2.5, 0.3], { color: MAZE_COLOR }),  // bottom
    wall(-5, 0, [0.3, 2.5, 10.0], { color: MAZE_COLOR }),  // left
    wall(5, 0, [0.3, 2.5, 10.0], { color: MAZE_COLOR }),  // right

    // ── Inner maze walls ───────────────────────────────────────────────────
    wall(-1.7, -2.2, [5.5, 2, 0.3], { color: MAZE_COLOR }),  // long horizontal (gap right)
    wall(1.1, -0.6, [0.3, 2, 3.3], { color: MAZE_COLOR }),  // vertical drop from gap
    wall(3.1, 1.1, [3.9, 2, 0.3], { color: MAZE_COLOR }),  // horizontal, right side
    wall(-2.8, -3.6, [0.3, 2, 2.8], { color: MAZE_COLOR }),  // vertical, left upper
    wall(-1.1, 2.8, [0.3, 2, 3.3], { color: MAZE_COLOR }),  // vertical, inner loop
    wall(-3.6, 2.8, [1.7, 2, 0.3], { color: MAZE_COLOR }),  // short horizontal, top-left
    wall(3.3, 3.1, [0.3, 2, 3.9], { color: MAZE_COLOR }),  // vertical, right lower
];

// ─────────────────────────────────────────────
// Exported catalogue
// ─────────────────────────────────────────────
export const SCENARIO_PRESETS: ScenarioPreset[] = [
    {
        id: 'warehouse',
        label: 'Almacén',
        icon: '🏭',
        obstacles: warehouseObstacles,
    },
    {
        id: 'corridor',
        label: 'Pasillo',
        icon: '🚧',
        obstacles: corridorObstacles,
    },
    {
        id: 'maze',
        label: 'Laberinto',
        icon: '🧩',
        obstacles: mazeObstacles,
    },
];
