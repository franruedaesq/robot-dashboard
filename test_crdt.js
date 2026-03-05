import { initSync, WasmStateStore } from './node_modules/@crdt-sync/core/pkg/web/crdt_sync.js';
import fs from 'fs';

const wasmBuffer = fs.readFileSync('./node_modules/@crdt-sync/core/pkg/web/crdt_sync_bg.wasm');
initSync(wasmBuffer);

const store = new WasmStateStore('client-1');

console.log("Setting register...");
store.set_register("obstacles", JSON.stringify([{ id: "obs-1", type: "box" }]));
console.log("Set successful!");

let envelope = store.set_register("obstacles", JSON.stringify([{ id: "obs-2", type: "wall" }]));
console.log("Set 2 successful!", envelope);

// try getting
let val = store.get_register("obstacles");
console.log("Get successful!", val);

// Try to simulate the proxy
const proxy = new Proxy({}, {
    get: (_target, prop) => {
        const raw = store.get_register(String(prop));
        return raw !== undefined ? JSON.parse(raw) : undefined;
    },
    set: (_target, prop, value) => {
        const key = String(prop);
        const envelope = store.set_register(key, JSON.stringify(value));
        console.log("Proxy set done for envelope", envelope);

        // simulate emit
        let read = proxy[key]; // reads the proxy recursively?
        console.log("Proxy emit side effect read:", read);
        return true;
    }
});

proxy.obstacles = [{ id: "obs-3", type: "person" }];
console.log("Proxy test complete");
