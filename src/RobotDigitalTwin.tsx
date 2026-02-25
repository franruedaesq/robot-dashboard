import { useState, useRef, useMemo, useCallback, useEffect, useContext } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as ROSLIB from 'roslib';
import * as THREE from 'three';

import type { RobotPose, PackageMap, ObstacleConfig, ObstacleType, ScenarioPreset } from './types';
import { parseUrdf, parseSensors } from './utils/urdf';
import type { DetectedSensor } from './utils/urdf';
import { useIsMobile } from './utils/media';
import { PRELOADED_ROBOTS } from './robots/catalog';
import { SPAWN_Y, DEFAULT_SCALE, DEFAULT_COLOR } from './scenarios/presets';
import { World } from './components/World';
import { RobotPhysicsBody } from './components/RobotPhysicsBody';
import { RobotSelectorPanel } from './components/RobotSelectorPanel';
import { RealLiDARPanel } from './components/RealLiDARPanel';
import { PlacementOverlay } from './components/PlacementOverlay';
import { WorldEditorPanel } from './components/WorldEditorPanel';
import { RobotArmPanel } from './components/RobotArmPanel';
import { HeadlessContext } from './contexts/HeadlessContext';
import { useCrdtWorld } from './contexts/CrdtWorldContext';
import { HeadlessEngine } from './components/HeadlessEngine';
import { getRobotConfig, updateRobotConfig } from './utils/storage';
import { useOctree } from '@spatial-engine/react';
import type { OctreeOptions } from '@spatial-engine/react';
import { SpatialEngineContext } from './contexts/SpatialEngineContext';

// ─────────────────────────────────────────────
// Velocity helpers
// ─────────────────────────────────────────────
type Velocity = { linear: number; angular: number };
const STOP: Velocity = { linear: 0, angular: 0 };

function keysToVelocity(held: Set<string>): Velocity {
    const fwd = held.has('ArrowUp') || held.has('w') || held.has('W');
    const bwd = held.has('ArrowDown') || held.has('s') || held.has('S');
    const lft = held.has('ArrowLeft') || held.has('a') || held.has('A');
    const rgt = held.has('ArrowRight') || held.has('d') || held.has('D');
    if (!fwd && !bwd && !lft && !rgt) return STOP;
    return {
        linear: fwd ? 2.0 : bwd ? -2.0 : 0.5,
        angular: lft ? 2.0 : rgt ? -2.0 : 0,
    };
}

// ─────────────────────────────────────────────
// Floating D-pad overlay
// ─────────────────────────────────────────────
function DPad({ onDown, onUp, style }: { onDown: (v: Velocity) => void; onUp: () => void; style?: React.CSSProperties }) {
    const btn = (icon: string, v: Velocity) => (
        <button
            onPointerDown={e => { e.preventDefault(); onDown(v); }}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            style={{
                width: 44, height: 44, fontSize: '1.1rem', cursor: 'pointer',
                backgroundColor: 'rgba(30,56,96,0.85)', color: 'white',
                border: '1px solid rgba(58,110,165,0.7)', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                userSelect: 'none', backdropFilter: 'blur(4px)',
            }}
        >{icon}</button>
    );
    const stopBtn = (
        <button
            onClick={onUp}
            style={{
                width: 44, height: 44, fontSize: '1rem', cursor: 'pointer',
                backgroundColor: 'rgba(95,30,30,0.85)', color: 'white',
                border: '1px solid rgba(165,58,58,0.7)', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)', userSelect: 'none',
            }}
        >⏹</button>
    );
    return (
        <div style={{
            position: 'absolute', bottom: 48, left: 16, zIndex: 10,
            display: 'inline-grid',
            gridTemplateColumns: 'repeat(3, 44px)',
            gridTemplateRows: 'repeat(3, 44px)',
            gap: 4,
            ...style
        }}>
            <span />{btn('⬆️', { linear: 2.0, angular: 0.0 })}<span />
            {btn('↩️', { linear: 0.5, angular: 2.0 })}{stopBtn}{btn('↪️', { linear: 0.5, angular: -2.0 })}
            <span />{btn('⬇️', { linear: -2.0, angular: 0.0 })}<span />
        </div>
    );
}

// ─────────────────────────────────────────────
// Camera Manager for focusing robot
// ─────────────────────────────────────────────
function CameraManager({ pose, resetTrigger, heightOffset = 0, cameraFollow = true }: { pose: RobotPose, resetTrigger: number, heightOffset?: number, cameraFollow?: boolean }) {
    const { camera, controls } = useThree();
    const [animating, setAnimating] = useState(false);

    const prevTrigger = useRef(resetTrigger);
    const prevHeight = useRef(heightOffset);

    useEffect(() => {
        if (!controls) return;
        if (resetTrigger !== prevTrigger.current || heightOffset !== prevHeight.current) {
            setAnimating(true);
            prevTrigger.current = resetTrigger;
            prevHeight.current = heightOffset;
        }
    }, [resetTrigger, heightOffset, controls]);

    useFrame((_, delta) => {
        if (!controls) return;
        const r_controls = controls as any;
        const speed = 1.0 - Math.exp(-6 * delta);

        // The target the robot is actually at right now
        const idealTarget = new THREE.Vector3(pose.x, pose.y + 0.3 + heightOffset, pose.z);

        if (animating) {
            // Isometric perspective relative to robot
            const idealCamPos = new THREE.Vector3(pose.x + 1.5, pose.y + 1.5 + heightOffset, pose.z + 2.0);

            camera.position.lerp(idealCamPos, speed);
            r_controls.target.lerp(idealTarget, speed);
            r_controls.update();

            // Stop animating once we are close enough
            if (
                camera.position.distanceToSquared(idealCamPos) < 0.001 &&
                r_controls.target.distanceToSquared(idealTarget) < 0.001
            ) {
                setAnimating(false);
            }
        }
        else if (cameraFollow) {
            // Smoothly track the target without changing the user's rotation/zoom
            const diff = new THREE.Vector3().subVectors(idealTarget, r_controls.target);

            if (diff.lengthSq() > 0.000001) {
                // Move a percentage of the distance per frame (framerate independent)
                const step = diff.multiplyScalar(1.0 - Math.exp(-10 * delta));

                // Disable OrbitControl's internal damping for a moment so our manual updates aren't fought
                const wasDamping = r_controls.enableDamping;
                r_controls.enableDamping = false;

                // Move BOTH camera and target exactly the same amount, locking the relative perspective
                r_controls.target.add(step);
                camera.position.add(step);

                r_controls.update(); // Sync internal spherical state instantly
                r_controls.enableDamping = wasDamping;
            }
        }
    });

    return null;
}

// ─────────────────────────────────────────────
// PhysicsWorld — keyed per worldKey so the octree
// is fully reset on every scenario switch.
// ─────────────────────────────────────────────
const OCTREE_OPTIONS: OctreeOptions = { nodeCapacity: 1024, objectCapacity: 2048 };

interface PhysicsWorldProps {
    obstacles: ObstacleConfig[];
    parsed: ReturnType<typeof parseUrdf>;
    metrics: { spawnY: number; size: [number, number, number] };
    visualYOffset: number;
    velocity: { linear: number; angular: number };
    ros: ROSLIB.Ros | null;
    simLidarEnabled: boolean;
    simCamEnabled: boolean;
    simJointsEnabled: boolean;
    thumbnailCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    camHttpEndpoint: string;
    expandedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    onPoseUpdate: (pose: RobotPose) => void;
    batchSize: number;
    isHeadless: boolean;
}

function PhysicsWorld({
    obstacles, parsed, metrics, visualYOffset, velocity, ros,
    simLidarEnabled, simCamEnabled, simJointsEnabled,
    thumbnailCanvasRef, camHttpEndpoint, expandedCanvasRef,
    onPoseUpdate, batchSize, isHeadless,
}: PhysicsWorldProps) {
    const spatialHandle = useOctree(OCTREE_OPTIONS);
    // The root node AABB must be set before any inserts; without this the
    // octree cannot subdivide (mid-points are all zero) and every object
    // piles up in node 0 until MAX_OBJECTS_PER_NODE is exceeded.
    // Bounds match the 40 × 40 floor mesh plus generous vertical headroom.
    spatialHandle.octree.setBounds(-22, -2, -22, 22, 6, 22);

    return (
        <SpatialEngineContext.Provider value={spatialHandle}>
            <Physics gravity={[0, -9.81, 0]} paused={isHeadless}>
                <HeadlessEngine />
                <World obstacles={obstacles} />
                {Array.from({ length: batchSize }).map((_, i) => (
                    <RobotPhysicsBody
                        key={`robot-${i}`}
                        robotIndex={i}
                        parsed={parsed ? { ...parsed, spawnY: metrics.spawnY, size: metrics.size, visualYOffset } : null}
                        velocity={velocity}
                        ros={ros}
                        simLidarEnabled={simLidarEnabled}
                        simCamEnabled={simCamEnabled && i === 0}
                        simJointsEnabled={simJointsEnabled}
                        thumbnailCanvasRef={thumbnailCanvasRef}
                        camHttpEndpoint={camHttpEndpoint || undefined}
                        expandedCanvasRef={expandedCanvasRef}
                        onPoseUpdate={i === 0 ? onPoseUpdate : undefined}
                    />
                ))}
            </Physics>
        </SpatialEngineContext.Provider>
    );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
const defaultRobot = PRELOADED_ROBOTS[0];

export default function RobotDigitalTwin({ ros }: { ros: ROSLIB.Ros | null }) {
    const isMobile = useIsMobile();
    const { isHeadless, setIsHeadless, timeScale, setTimeScale, batchSize, setBatchSize, metrics: rlMetrics } = useContext(HeadlessContext);

    // ── URDF / robot state ───────────────────────────────────────────────────
    const [urdfText, setUrdfText] = useState<string>(defaultRobot.urdf);
    const [pkgMap, setPkgMap] = useState<PackageMap>(defaultRobot.pkgMap);
    const [forwardAngle, setForwardAngle] = useState<number>(defaultRobot.forwardAngle ?? 0);
    const [visualYOffset, setVisualYOffset] = useState<number>(defaultRobot.visualYOffset ?? 0);
    const [pose, setPose] = useState<RobotPose>({ x: 0, y: 0, z: 0, yaw: 0 });
    const [metrics, setMetrics] = useState({ spawnY: 0.1, size: [0.2, 0.2, 0.2] as [number, number, number] });

    // ── Sensor toggles ───────────────────────────────────────────────────────
    const [showRealLidar, setShowRealLidar] = useState(false);
    const [simLidarEnabled, setSimLidarEnabled] = useState(false);
    const [simCamEnabled, setSimCamEnabled] = useState(false);
    const [simJointsEnabled, setSimJointsEnabled] = useState(true);
    const [camHttpEndpoint, setCamHttpEndpoint] = useState('');
    const [camExpanded, setCamExpanded] = useState(false);
    const thumbnailCanvasRef = useRef<HTMLCanvasElement>(null);
    const expandedCanvasRef = useRef<HTMLCanvasElement>(null);

    // ── World / obstacle state (CRDT-synced) ────────────────────────────────
    const { obstacles, setObstacles } = useCrdtWorld();
    const [worldKey, setWorldKey] = useState(0);
    const [placingType, setPlacingType] = useState<ObstacleType | null>(null);
    const [placingDynamic, setPlacingDynamic] = useState(true);
    const [placingRotation, setPlacingRotation] = useState(0); // 0 = horizontal, PI/2 = vertical

    // ── Camera controls ──────────────────────────────────────────────────────
    const [cameraResetTrigger, setCameraResetTrigger] = useState(0);
    const [cameraHeightOffset, setCameraHeightOffset] = useState(0);
    const [cameraFollow, setCameraFollow] = useState(true);

    // ── Velocity / controls ──────────────────────────────────────────────────
    const [velocity, setVelocity] = useState<Velocity>(STOP);
    const rosRef = useRef<ROSLIB.Ros | null>(null);
    rosRef.current = ros;

    const publishVel = useCallback((vel: Velocity) => {
        const r = rosRef.current;
        if (!r) return;
        const topic = new ROSLIB.Topic({ ros: r, name: '/cmd_vel', messageType: 'geometry_msgs/Twist' });
        topic.publish({ linear: { x: vel.linear, y: 0, z: 0 }, angular: { x: 0, y: vel.angular, z: 0 } });
    }, []);

    const sendVel = useCallback((vel: Velocity) => { setVelocity(vel); publishVel(vel); }, [publishVel]);
    const stop = useCallback(() => { setVelocity(STOP); publishVel(STOP); }, [publishVel]);

    // ── Keyboard controls ────────────────────────────────────────────────────
    useEffect(() => {
        const held = new Set<string>();
        const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];

        const update = () => { const vel = keysToVelocity(held); setVelocity(vel); publishVel(vel); };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setPlacingType(null); setCamExpanded(false); return; }
            if (!KEYS.includes(e.key)) return;
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            e.preventDefault();
            held.add(e.key);
            update();
        };

        const onKeyUp = (e: KeyboardEvent) => { held.delete(e.key); update(); };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [publishVel]);

    // ── External /cmd_vel Subscription ───────────────────────────────────────
    useEffect(() => {
        if (!ros) return;

        const cmdVelTopic = new ROSLIB.Topic({
            ros,
            name: '/cmd_vel',
            messageType: 'geometry_msgs/Twist'
        });

        const cb = (message: any) => {
            if (message?.linear && message?.angular) {
                setVelocity(prev => {
                    const newLin = message.linear.x;
                    const newAng = message.angular.z;
                    // Prevent unnecessary state updates if values are identical
                    if (prev.linear === newLin && prev.angular === newAng) return prev;
                    return { linear: newLin, angular: newAng };
                });
            }
        };

        cmdVelTopic.subscribe(cb);
        return () => cmdVelTopic.unsubscribe(cb);
    }, [ros]);

    // ── Sensor detection from URDF ───────────────────────────────────────────
    const detectedSensors = useMemo<DetectedSensor[]>(() => parseSensors(urdfText), [urdfText]);

    // ── URDF parsing ─────────────────────────────────────────────────────────
    const parsed = useMemo(() => {
        const p = parseUrdf(urdfText, pkgMap, (y, s) => setMetrics({ spawnY: y, size: s }), forwardAngle);
        if (p) setMetrics({ spawnY: p.spawnY, size: p.size });
        return p;
    }, [urdfText, pkgMap, forwardAngle]);

    const handleUrdfLoad = useCallback((text: string, map: PackageMap, fwdAngle?: number, vyOffset?: number) => {
        setPkgMap(map);
        setUrdfText(text);
        setForwardAngle(fwdAngle ?? 0);
        setVisualYOffset(vyOffset ?? 0);
    }, []);

    // Load config from localStorage whenever the parsed robot changes
    useEffect(() => {
        if (parsed?.name) {
            const config = getRobotConfig(parsed.name);
            if (config.visualYOffset !== undefined) setVisualYOffset(config.visualYOffset);
            if (config.cameraFollow !== undefined) setCameraFollow(config.cameraFollow);
            if (config.cameraHeightOffset !== undefined) setCameraHeightOffset(config.cameraHeightOffset);
        }
    }, [parsed?.name]);

    const handleVisualYOffsetChange = (val: number) => {
        setVisualYOffset(val);
        updateRobotConfig(parsed?.name, { visualYOffset: val });
    };

    const handleCameraFollowChange = (val: boolean) => {
        setCameraFollow(val);
        updateRobotConfig(parsed?.name, { cameraFollow: val });
    };

    const handleCameraHeightChange = (val: number) => {
        setCameraHeightOffset(val);
        updateRobotConfig(parsed?.name, { cameraHeightOffset: val });
    };

    // ── World editor actions ─────────────────────────────────────────────────
    const handleLoadScenario = useCallback((preset: ScenarioPreset) => {
        setObstacles(preset.obstacles);
        setWorldKey(k => k + 1); // remount Physics → robot resets to spawn
        setPlacingType(null);
    }, [setObstacles]);

    const handleClearAll = useCallback(() => {
        setObstacles([]);
        setWorldKey(k => k + 1);
        setPlacingType(null);
    }, [setObstacles]);

    const handlePlaceObstacle = useCallback((pos: THREE.Vector3) => {
        if (!placingType) return;
        const newObs: ObstacleConfig = {
            id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: placingType,
            position: [pos.x, SPAWN_Y[placingType], pos.z],
            rotation: placingRotation,
            scale: DEFAULT_SCALE[placingType],
            color: DEFAULT_COLOR[placingType],
            dynamic: placingDynamic,
        };
        setObstacles([...obstacles, newObs]);
        setPlacingType(null); // exit placement mode after placing one
    }, [placingType, placingDynamic, placingRotation, obstacles, setObstacles]);

    const handleDeleteObstacle = useCallback((id: string) => {
        setObstacles(obstacles.filter(o => o.id !== id));
    }, [obstacles, setObstacles]);

    const handleToggleRotation = useCallback(() => {
        setPlacingRotation(r => r === 0 ? Math.PI / 2 : 0);
    }, []);

    // ── Sensor toggle button helper ───────────────────────────────────────────
    const panelBtn = (label: string, active: boolean, onClick: () => void): React.ButtonHTMLAttributes<HTMLButtonElement> => ({
        style: {
            padding: '6px 14px', fontSize: '0.78rem', cursor: 'pointer',
            backgroundColor: active ? '#1e5f3f' : '#1e2a3f',
            color: active ? '#00ff88' : '#aaa',
            border: `1px solid ${active ? '#00ff88' : '#3a4a6a'}`,
            borderRadius: '6px', transition: 'all 0.15s',
        } as React.CSSProperties,
        onClick,
        children: label,
    });

    return (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '8px' : '16px', flex: 1, minHeight: 0, minWidth: 0, width: '100%', height: '100%' }}>

            {/* ── Left Side: 3D Canvas ────────────────────────────────────────── */}
            <div style={{
                position: 'relative', flex: isMobile ? 'none' : 1, minWidth: 0, height: isMobile ? '45vh' : '100%', flexShrink: 0,
                border: '2px solid #2a2a4a', borderRadius: '12px', overflow: 'hidden',
                cursor: placingType ? 'crosshair' : 'grab',
            }}
                onDoubleClick={(e) => {
                    // Only trigger if double clicking the container itself (or canvas)
                    // to avoid triggering when double clicking UI buttons
                    if (e.target instanceof HTMLCanvasElement) {
                        setCameraResetTrigger(c => c + 1);
                    }
                }}>
                {isHeadless && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 100,
                        backgroundColor: '#050505',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        color: '#ff0055', fontFamily: 'monospace'
                    }}>
                        <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>MODO HEADLESS</h2>
                        <p style={{ fontSize: '1rem', color: '#888' }}>Simulación acelerada en progreso ({timeScale}x)</p>
                        <p style={{ fontSize: '0.85rem', color: '#666' }}>{rlMetrics.simStepsPerSec} steps/s</p>
                    </div>
                )}
                <Canvas

                    camera={{ position: [4, 4, 6], fov: 50 }}
                    shadows={{ type: THREE.PCFShadowMap }}
                    style={{ height: '100%', background: 'linear-gradient(180deg, #0d0d1a 0%, #1a1a2e 100%)' }}
                >
                    <ambientLight intensity={0.4} />
                    <directionalLight
                        castShadow
                        position={[10, 10, 5]}
                        intensity={1.2}
                        shadow-mapSize={[2048, 2048]}
                        shadow-camera-left={-20}
                        shadow-camera-right={20}
                        shadow-camera-top={20}
                        shadow-camera-bottom={-20}
                        shadow-bias={-0.0001}
                    />
                    <pointLight position={[-5, 5, -5]} intensity={0.5} color="#6644aa" />

                    <CameraManager pose={pose} resetTrigger={cameraResetTrigger} heightOffset={cameraHeightOffset} cameraFollow={cameraFollow} />

                    <PhysicsWorld
                        key={worldKey}
                        obstacles={obstacles}
                        parsed={parsed}
                        metrics={metrics}
                        visualYOffset={visualYOffset}
                        velocity={velocity}
                        ros={ros}
                        simLidarEnabled={simLidarEnabled}
                        simCamEnabled={simCamEnabled}
                        simJointsEnabled={simJointsEnabled}
                        thumbnailCanvasRef={thumbnailCanvasRef}
                        camHttpEndpoint={camHttpEndpoint}
                        expandedCanvasRef={expandedCanvasRef}
                        onPoseUpdate={setPose}
                        batchSize={batchSize}
                        isHeadless={isHeadless}
                    />

                    {/* Ghost preview + floor raycasting for placement */}
                    <PlacementOverlay
                        active={placingType !== null}
                        type={placingType}
                        rotation={placingRotation}
                        onPlace={handlePlaceObstacle}
                    />

                    {/* Disable orbit while placing so clicks don't also orbit */}
                    <OrbitControls makeDefault enabled={placingType === null} />
                </Canvas>

                {/* Floating D-pad */}
                <DPad onDown={sendVel} onUp={stop} />

                {/* Keyboard hint */}
                {/* {!isMobile && <KeyboardHint />} */}

                {/* Placement mode banner */}
                {placingType && (
                    <div style={{
                        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(90,175,255,0.15)',
                        border: '1px solid rgba(90,175,255,0.4)',
                        borderRadius: 8, padding: '5px 16px',
                        fontFamily: 'monospace', fontSize: '0.75rem', color: '#8cf',
                        pointerEvents: 'none', whiteSpace: 'nowrap',
                    }}>
                        💡 Modo colocación — haz clic en el suelo &nbsp;·&nbsp; Esc para cancelar
                    </div>
                )}

                {/* Odometry HUD — bottom centre */}
                <div style={{
                    position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                    fontFamily: 'monospace', fontSize: '0.72rem', color: '#8be',
                    backgroundColor: 'rgba(13,18,32,0.82)', border: '1px solid #2a3a5a',
                    borderRadius: 6, padding: '3px 12px', letterSpacing: '0.03em',
                    pointerEvents: 'none', whiteSpace: 'nowrap',
                }}>
                    x: <b>{pose.x.toFixed(2)}</b> &nbsp;
                    y: <b>{pose.y.toFixed(2)}</b> &nbsp;
                    z: <b>{pose.z.toFixed(2)}</b> &nbsp;
                    θ: <b>{((pose.yaw * 180) / Math.PI).toFixed(1)}°</b>
                    &nbsp;<span style={{ color: '#3f6' }}>→ /sim_odom</span>

                    <button
                        onClick={() => setCameraResetTrigger(c => c + 1)}
                        title="Centrar cámara (doble clic en 3D)"
                        style={{
                            marginLeft: 12, padding: '2px 6px', fontSize: '0.8rem', cursor: 'pointer',
                            backgroundColor: '#1e3860', color: '#fff', border: '1px solid #3a6ea5',
                            borderRadius: 4, transition: 'all 0.1s'
                        }}
                    >
                        🎯
                    </button>
                </div>

                {/* Robot info — top left */}
                {parsed && (
                    <div style={{
                        position: 'absolute', top: 10, left: 12,
                        fontFamily: 'monospace', fontSize: '0.72rem', color: '#7ac',
                        backgroundColor: 'rgba(13,18,32,0.82)', border: '1px solid #1e2a4a',
                        borderRadius: 6, padding: '3px 10px', pointerEvents: 'none',
                    }}>
                        🤖 <b>{parsed.name}</b> &nbsp;
                        {metrics.size.map(v => v.toFixed(2)).join(' × ')} m
                    </div>
                )}

                {/* Scenario tag — top right */}
                {obstacles.length > 0 && !placingType && (
                    <div style={{
                        position: 'absolute', top: 10, right: 12,
                        fontFamily: 'monospace', fontSize: '0.68rem', color: '#567',
                        backgroundColor: 'rgba(13,18,32,0.75)', border: '1px solid #1e2a4a',
                        borderRadius: 6, padding: '3px 8px', pointerEvents: 'none',
                    }}>
                        {obstacles.length} objeto{obstacles.length !== 1 ? 's' : ''} en escena
                    </div>
                )}

                {/* Sim camera thumbnail — bottom right */}
                {simCamEnabled && (
                    <div style={{
                        position: 'absolute', bottom: 10, right: 10,
                        border: '2px solid #3498db', borderRadius: 6, overflow: 'hidden',
                        boxShadow: '0 0 12px #3498db66',
                    }}>
                        <div style={{ fontSize: '0.6rem', color: '#3498db', backgroundColor: '#0d0d1a', padding: '2px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'monospace' }}>
                            <span>/sim_camera/compressed</span>
                            <button
                                onClick={() => setCamExpanded(true)}
                                title="Expand camera view"
                                style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px', lineHeight: 1 }}
                            >⤢</button>
                        </div>
                        <canvas ref={thumbnailCanvasRef} width={160} height={120} style={{ display: 'block', cursor: 'pointer' }} onClick={() => setCamExpanded(true)} />
                        <div style={{ backgroundColor: '#0d0d1a', padding: '4px 6px' }}>
                            <input
                                type="text"
                                value={camHttpEndpoint}
                                onChange={e => setCamHttpEndpoint(e.target.value)}
                                placeholder="http://localhost:5000/frame"
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    backgroundColor: '#111827', color: '#8be',
                                    border: '1px solid #2a3a5a', borderRadius: 4,
                                    fontFamily: 'monospace', fontSize: '0.6rem',
                                    padding: '3px 5px', outline: 'none',
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Right Side: Controls ────────────────────────────────────────── */}
            <div style={{
                width: isMobile ? '100%' : '360px', flex: isMobile ? 1 : 'none', flexShrink: 0, height: isMobile ? 'auto' : '100%',
                overflowY: 'auto', paddingRight: isMobile ? '0' : '8px', paddingBottom: '16px',
                boxSizing: 'border-box'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* ── RL Headless Training ─────────────────────────────────────────────── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: isHeadless ? '#1e0020' : '#0a0f18', padding: '12px', borderRadius: '10px', border: `1px solid ${isHeadless ? '#ff0055' : '#1e2a4a'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: isHeadless ? '#ff0055' : '#aaa', fontWeight: 600 }}>🧪 Entrenamiento IA (Headless)</span>
                            <button
                                onClick={() => setIsHeadless(!isHeadless)}
                                style={{ padding: '4px 10px', fontSize: '0.7rem', backgroundColor: isHeadless ? '#ff0055' : '#2a2a4a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                                {isHeadless ? 'Desactivar' : 'Activar'}
                            </button>
                        </div>
                        {isHeadless && (
                            <div style={{ fontSize: '0.75rem', color: '#f8c', marginTop: 4 }}>
                                <div>🚀 {rlMetrics.simStepsPerSec} timesteps/sec ({(rlMetrics.simStepsPerSec / 60).toFixed(1)}x real time)</div>
                                <div style={{ fontSize: '0.65rem', color: '#aaa', marginTop: 4 }}>
                                    Robots publicando LiDAR acelerado. La UI 3D está pausada para dar CPU a la IA.
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', marginTop: 6 }}>
                            <label style={{ width: 60, color: '#8be' }}>Batch Size</label>
                            <input type="range" min="1" max="10" step="1" value={batchSize} onChange={e => setBatchSize(parseInt(e.target.value))} style={{ flex: 1 }} />
                            <span style={{ width: 20 }}>{batchSize}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
                            <label style={{ width: 60, color: '#8be' }}>Time Scale</label>
                            <input type="range" min="1" max="50" step="1" value={timeScale} onChange={e => setTimeScale(parseInt(e.target.value))} style={{ flex: 1 }} />
                            <span style={{ width: 20 }}>{timeScale}x</span>
                        </div>
                    </div>

                    {/* ── Sensor toggles ─────────────────────────────────────────────── */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', backgroundColor: '#0a0f18', padding: '12px', borderRadius: '10px', border: '1px solid #1e2a4a' }}>
                        <button {...panelBtn('📡 LiDAR Real (/scan)', showRealLidar, () => setShowRealLidar(v => !v))} />
                        <button {...panelBtn('🔴 Sim LiDAR Rays', simLidarEnabled, () => setSimLidarEnabled(v => !v))} />
                        <button {...panelBtn('📷 Sim Camera', simCamEnabled, () => setSimCamEnabled(v => !v))} />
                        <button {...panelBtn('🦾 Feedback (/joint_states)', simJointsEnabled, () => setSimJointsEnabled(v => !v))} />
                    </div>

                    {/* ── Visual Vertical Offset ─────────────────────────────────────── */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#0d1220', border: '1px solid #1e2a4a', borderRadius: 8, padding: '10px 14px', color: '#cde', fontSize: '0.8rem', width: '100%', boxSizing: 'border-box' }}>
                        <label>↕️ Ajuste Y (Robot Visual):</label>
                        <input
                            type="range"
                            min="-1.0" max="1.0" step="0.01"
                            value={visualYOffset}
                            onChange={e => handleVisualYOffsetChange(parseFloat(e.target.value))}
                            style={{ flex: 1, cursor: 'pointer' }}
                        />
                        <span style={{ width: '50px', fontFamily: 'monospace', textAlign: 'right' }}>{visualYOffset.toFixed(2)}m</span>
                    </div>

                    {/* ── Camera Controls ───────────────────────────────────────────── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#0d1220', border: '1px solid #1e2a4a', borderRadius: 8, padding: '10px 14px', color: '#cde', fontSize: '0.8rem', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input type="checkbox" checked={cameraFollow} onChange={e => handleCameraFollowChange(e.target.checked)} />
                                🎥 Seguir al Robot
                            </label>
                            <button
                                onClick={() => setCameraResetTrigger(c => c + 1)}
                                style={{
                                    padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer',
                                    backgroundColor: '#1e3860', color: '#fff', border: '1px solid #3a6ea5',
                                    borderRadius: 4, transition: 'all 0.1s'
                                }}
                            >
                                🎯 Centrar Vista
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label>↕️ Elevación Cámara:</label>
                            <input
                                type="range"
                                min="-1.5" max="1.5" step="0.01"
                                value={cameraHeightOffset}
                                onChange={e => handleCameraHeightChange(parseFloat(e.target.value))}
                                style={{ flex: 1, cursor: 'pointer' }}
                            />
                            <span style={{ width: '40px', fontFamily: 'monospace', textAlign: 'right' }}>{cameraHeightOffset.toFixed(2)}m</span>
                        </div>
                    </div>

                    {/* ── Detected sensors from URDF ─────────────────────────────────── */}
                    {detectedSensors.length > 0 && (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                            backgroundColor: '#080d1a', border: '1px solid #1e2a4a',
                            borderRadius: 10, padding: '10px 14px', width: '100%',
                            boxSizing: 'border-box',
                        }}>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#456', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                Sensores detectados en URDF
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                                {detectedSensors.map(sensor => (
                                    <div
                                        key={sensor.type}
                                        title={sensor.links.join('\n')}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 5,
                                            backgroundColor: '#0d1a2e', border: '1px solid #2a3a5a',
                                            borderRadius: 20, padding: '4px 12px',
                                            fontFamily: 'monospace', fontSize: '0.75rem', color: '#8be',
                                            cursor: 'default',
                                        }}
                                    >
                                        <span>{sensor.icon}</span>
                                        <span>{sensor.label}</span>
                                        <span style={{
                                            backgroundColor: '#1e3860', color: '#5af',
                                            borderRadius: 10, padding: '1px 7px', fontSize: '0.7rem',
                                        }}>
                                            {sensor.links.length}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* ── Robot Arm Controls ─────────────────────────────────────────── */}
                    <RobotArmPanel parsed={parsed} ros={ros} />

                    {/* ── World editor ───────────────────────────────────────────────── */}
                    <WorldEditorPanel
                        obstacles={obstacles}
                        placingType={placingType}
                        placingDynamic={placingDynamic}
                        placingRotation={placingRotation}
                        onSelectType={setPlacingType}
                        onToggleDynamic={setPlacingDynamic}
                        onToggleRotation={handleToggleRotation}
                        onLoadScenario={handleLoadScenario}
                        onClearAll={handleClearAll}
                        onDeleteObstacle={handleDeleteObstacle}
                    />

                    {/* ── Robot selector ─────────────────────────────────────────────── */}
                    <RobotSelectorPanel onLoad={handleUrdfLoad} />

                    {/* ── LiDAR panels ───────────────────────────────────────────── */}
                    {showRealLidar && (
                        <div style={{ backgroundColor: '#0d0d1a', border: '1px solid #2a2a4a', borderRadius: 10, padding: 12 }}>
                            <RealLiDARPanel ros={ros} topicName="/scan" title="🟢 /scan — Real LiDAR" />
                        </div>
                    )}
                    {simLidarEnabled && (
                        <div style={{ backgroundColor: '#0d0d1a', border: '1px solid #c0392b', borderRadius: 10, padding: 12 }}>
                            <RealLiDARPanel ros={ros} topicName="/sim_scan" title="🔴 /sim_scan — Sim LiDAR" />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Expanded camera modal ───────────────────────────────────────── */}
            {camExpanded && (
                <div
                    onClick={() => setCamExpanded(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            border: '2px solid #3498db', borderRadius: 10, overflow: 'hidden',
                            boxShadow: '0 0 40px #3498db66',
                            width: isMobile ? '95vw' : 'auto', maxWidth: 640
                        }}
                    >
                        <div style={{ backgroundColor: '#0d0d1a', padding: '4px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '0.72rem', color: '#3498db' }}>
                            <span>Sim Camera — robot POV</span>
                            <button onClick={() => setCamExpanded(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0 2px' }}>✕</button>
                        </div>
                        <canvas ref={expandedCanvasRef} width={640} height={480} style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '4/3' }} />
                    </div>
                    {isMobile && (
                        <div style={{ marginTop: '20px', pointerEvents: 'auto' }} onClick={e => e.stopPropagation()}>
                            <DPad onDown={sendVel} onUp={stop} style={{ position: 'relative', bottom: 0, left: 0 }} />
                        </div>
                    )}
                    <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(100,140,180,0.6)' }}>
                        click outside or press Esc to close
                    </div>
                </div>
            )}
        </div>
    );
}
