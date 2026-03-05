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
