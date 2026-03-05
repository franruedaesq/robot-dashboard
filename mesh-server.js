import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8001;

// Enable CORS for all routes so the React app on :5173 can fetch the STLs
app.use(cors());

// Serve the directory where meshes are supposed to be as static files.
// We assume meshes will be placed inside src/assets/robots/
app.use('/', express.static(path.join(__dirname, 'src', 'assets', 'robots')));

app.listen(PORT, () => {
    console.log(`\n========================================================`);
    console.log(`🚀 Servidor Local de Meshes 3D encendido en http://localhost:${PORT}`);
    console.log(`========================================================`);
    console.log(`👉 IMPORTANTE: Para que tus archivos .urdf encuentren sus formas 3D (.stl/.dae)`);
    console.log(`   asegúrate de copiar la carpeta entera del robot (`);
    console.log(`   ej: turtlebot3_description) dentro de:`);
    console.log(`   📁 src/assets/robots/`);
    console.log(`========================================================\n`);
});

// ── CRDT Sync Relay (port 8002) ──────────────────────────────────────────────
// The @crdt-sync/core WebSocketManager waits for a { type:"SNAPSHOT" } message
// before it will flush any locally-queued envelopes to peers.  Without it,
// _snapshotReceived stays false and obstacle updates are silently dropped.
//
// Protocol used by WebSocketManager:
//   Server → Client:  { type: "SNAPSHOT", data: JSON.stringify(envelope[]) }
//   Server → Client:  { type: "UPDATE",   data: JSON.stringify(envelope[]) }
//   Client → Server:  JSON.stringify(envelope[])   (array of CRDT envelopes)

const CRDT_PORT = 8002;
const crdtServer = http.createServer((_req, res) => { res.writeHead(404); res.end(); });
const wss = new WebSocketServer({ noServer: true });

/**
 * Per-room state:
 *   peers    – Set of connected WebSockets
 *   snapshot – All envelopes ever received, used to hydrate new joiners
 * @type {Map<string, { peers: Set<import('ws').WebSocket>, snapshot: string[] }>}
 */
const rooms = new Map();

crdtServer.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
        const room = req.url ?? '/';

        if (!rooms.has(room)) rooms.set(room, { peers: new Set(), snapshot: [] });
        const { peers, snapshot } = rooms.get(room);
        peers.add(ws);

        // Hydrate the new client with everything the room knows so far.
        const snapshotMsg = JSON.stringify({ type: 'SNAPSHOT', data: JSON.stringify(snapshot) });
        ws.send(snapshotMsg);

        ws.on('message', (data) => {
            let envelopes;
            try { envelopes = JSON.parse(data.toString()); } catch { return; }
            if (!Array.isArray(envelopes)) return;

            // Persist to snapshot so future joiners get a full picture.
            snapshot.push(...envelopes);

            // Broadcast as UPDATE to every other peer in the room.
            const updateMsg = JSON.stringify({ type: 'UPDATE', data: JSON.stringify(envelopes) });
            peers.forEach(client => {
                if (client !== ws && client.readyState === 1 /* OPEN */) {
                    client.send(updateMsg);
                }
            });
        });

        ws.on('close', () => {
            peers.delete(ws);
            // Keep snapshot alive even when room is empty so state is preserved.
        });
    });
});

crdtServer.listen(CRDT_PORT, () => {
    console.log(`🔄 CRDT relay server on ws://localhost:${CRDT_PORT}`);
});

// ── Server-Authoritative Physics Engine (port 8003) ──────────────────────────
// Runs a headless Rapier3D physics simulation via @nexus-physics/core (Wasm).
// The physics loop runs continuously at 60Hz, independent of any browser tab.
// Clients connect via WebSocket, receive snapshot broadcasts, and send commands.
//
// Protocol:
//   Server → Client:  { type: "snapshot", entries: [...] }
//   Client → Server:  { type: "cmd_vel", linear: number, angular: number }

const PHYSICS_PORT = 8003;
const PHYSICS_HZ = 60;
const PHYSICS_DT = 1 / PHYSICS_HZ;

async function startPhysicsEngine() {
    // Dynamic import so the top-level module doesn't block if Wasm isn't ready
    const nexusModule = await import('@nexus-physics/core');

    // In Node.js, the wasm module is loaded synchronously and exported directly or under .default.
    const WasmPhysicsWorld = nexusModule.WasmPhysicsWorld || nexusModule.default.WasmPhysicsWorld;

    if (typeof nexusModule.default === 'function') {
        await nexusModule.default();  // Bootstrap the Wasm module if it is a browser build
    }

    // Constructor takes (gx, gy, gz) as separate args
    const world = new WasmPhysicsWorld(0, -9.81, 0);

    // ── Static floor (matches World.tsx: 40×0.1×40 box at y=-0.05) ────────
    // add_body(entity_id, body_type_str, shape_type, dims, px, py, pz)
    world.add_body('floor', 'static', 'cuboid', new Float32Array([20, 0.05, 20]), 0, -0.05, 0);

    // ── Robot body (matches RobotPhysicsBody.tsx: cuboid collider) ─────────
    world.add_body('robot', 'dynamic', 'cuboid', new Float32Array([0.15, 0.1, 0.15]), 0, 0.3, 0);

    // Map entity_id → snapshot index (dynamic bodies get sequential indices)
    // Static bodies don't appear in snapshots, so robot is index 0
    const entityIds = ['robot']; // ordered by insertion of dynamic bodies

    console.log(`⚛️  Physics world created — floor + robot body added`);

    /**
     * Parse the Float32Array snapshot buffer into JSON entries.
     * Layout per body: [index, x, y, z, qx, qy, qz, qw] — 8 floats.
     */
    function snapshotToJSON(buffer) {
        const entries = [];
        for (let i = 0; i < buffer.length; i += 8) {
            const idx = buffer[i];
            entries.push({
                entity_id: entityIds[idx] ?? `body_${idx}`,
                position: [buffer[i + 1], buffer[i + 2], buffer[i + 3]],
                rotation: [buffer[i + 4], buffer[i + 5], buffer[i + 6], buffer[i + 7]],
            });
        }
        return { type: 'snapshot', entries };
    }

    // ── WebSocket server for physics state broadcast ──────────────────────
    const physicsHttpServer = http.createServer((_req, res) => { res.writeHead(404); res.end(); });
    const physicsWss = new WebSocketServer({ noServer: true });
    /** @type {Set<import('ws').WebSocket>} */
    const physicsClients = new Set();

    // Track the current velocity command (applied each tick)
    let currentLinear = 0;
    let currentAngular = 0;

    physicsHttpServer.on('upgrade', (req, socket, head) => {
        physicsWss.handleUpgrade(req, socket, head, (ws) => {
            physicsClients.add(ws);
            console.log(`⚛️  Physics client connected (${physicsClients.size} total)`);

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'cmd_vel') {
                        currentLinear = msg.linear ?? 0;
                        currentAngular = msg.angular ?? 0;
                    }
                } catch { /* ignore malformed */ }
            });

            ws.on('close', () => {
                physicsClients.delete(ws);
                console.log(`⚛️  Physics client disconnected (${physicsClients.size} total)`);
            });

            // Send immediate snapshot so the client knows where everything is
            try {
                const buffer = world.get_snapshot_view();
                const snapshot = snapshotToJSON(buffer);
                ws.send(JSON.stringify(snapshot));
            } catch { /* client may have disconnected */ }
        });
    });

    physicsHttpServer.listen(PHYSICS_PORT, () => {
        console.log(`⚛️  Physics engine running at ${PHYSICS_HZ}Hz on ws://localhost:${PHYSICS_PORT}`);
    });

    // ── 60Hz Physics Loop ─────────────────────────────────────────────────
    setInterval(() => {
        // Apply current velocity command to the robot body.
        // Convert (linear, angular) differential-drive into world-space velocity.
        const rot = world.get_rotation('robot');        // Float32Array [qx, qy, qz, qw]
        const yaw = 2 * Math.atan2(rot[1], rot[3]);    // extract yaw from quaternion
        const vx = Math.cos(yaw) * currentLinear;
        const vz = -Math.sin(yaw) * currentLinear;

        // set_velocity(entity_id, lx, ly, lz, ax, ay, az) — combined linear + angular
        // We let gravity handle Y velocity naturally by reading current pos delta
        world.set_velocity('robot', vx, 0, vz, 0, currentAngular, 0);

        // Step physics
        world.step(PHYSICS_DT);

        // Broadcast snapshot to all connected clients
        if (physicsClients.size > 0) {
            const buffer = world.get_snapshot_view();
            const snapshot = snapshotToJSON(buffer);
            const msg = JSON.stringify(snapshot);
            physicsClients.forEach(client => {
                if (client.readyState === 1 /* OPEN */) {
                    try { client.send(msg); } catch { /* ignore */ }
                }
            });
        }
    }, 1000 / PHYSICS_HZ);
}

startPhysicsEngine().catch(err => {
    console.error('❌ Failed to start physics engine:', err);
});
