# Rust & WebAssembly: Memory and Performance for Mobile 3D Games

When building complex 3D applications or games for the web (especially mobile browsers) using libraries like Three.js, introducing Rust compiled to WebAssembly (WASM) presents trade-offs regarding memory usage and overall performance.

---

## 1. Do Rust/WASM libraries use more or less memory?

**The short answer:** They generally give you **finer control over memory**, but they **often require a higher initial memory overhead** compared to writing equivalent logic entirely in JavaScript.

### Why?
* **Linear Memory Block:** When a WebAssembly module loads, it allocates a single, contiguous block of "linear memory" (essentially an array buffer). The Rust application manages its own memory within this block.
* **Overhead:** This block has an initial size and grows in fixed increments (pages). This means even a small WASM library might allocate a baseline of several megabytes of memory right away, whereas a JavaScript object only takes what it needs at that exact moment.
* **Lack of Garbage Collection (in WASM itself):** Rust manually manages memory inside that block. While this prevents the sudden, performance-killing pauses caused by the JavaScript garbage collector (GC), it means the browser cannot easily reclaim memory from the WASM linear block once it's grown, unless the entire WASM instance is destroyed.
* **Data Duplication (The Bridge):** A significant memory hit occurs when passing data back and forth between JavaScript (Three.js) and WASM (Rust). Because they don't share memory directly (without using highly complex SharedArrayBuffers), you often end up copying data. For example, copying a massive array of physics object positions from the Rust engine into JS arrays for Three.js to render effectively doubles the memory footprint of that data momentarily.

**Conclusion on Memory:** If not carefully managed, adding heavy WASM libraries (like physics engines) can rapidly increase your baseline memory usage, increasing the risk of Out-Of-Memory (OOM) crashes on constrained mobile browsers (like iOS Safari).

---

## 2. Do Rust/WASM libraries help make a 3D game go faster on mobile?

**The short answer:** Yes, for **heavy computational logic** (like physics or complex state syncing), but they **do not directly speed up rendering**.

### When WASM is Faster (The Computation Heavy-Lifting):
If your game involves calculating collisions for hundreds of rigid bodies, running complex pathfinding algorithms, or synchronizing large CRDT document states across the network, Rust/WASM is significantly faster than JavaScript.
* **Predictable Performance:** Because WASM is pre-compiled and doesn't rely on Just-In-Time (JIT) compilation or a garbage collector, the execution speed is highly predictable and often near-native. This is crucial for maintaining a stable 60 FPS in a physics simulation.

### When WASM is a Bottleneck (The Rendering Bridge):
WASM cannot directly talk to the WebGL or WebGPU APIs. All rendering commands must still go through JavaScript.
* **The Interop Cost:** Calling functions between JS and WASM has a slight overhead. If you are doing this thousands of times per frame (e.g., querying the WASM physics engine for the exact position of every single particle to render it in Three.js), the cost of crossing the JS/WASM bridge can negate the performance gains of the Rust computation.

---

## 3. Should we just stick to Three.js?

The decision depends entirely on the **type of game** you are building.

### Stick mostly to Three.js (JavaScript/TypeScript) IF:
1. **It's a visually driven game without complex background simulations.** If your game is mostly navigating static environments, simple animations, or basic arcade physics (like a simple endless runner), a pure JS/Three.js approach is sufficient and much safer for mobile memory constraints.
2. **You rely heavily on frequent, tiny interactions.** If the core game loop requires constant back-and-forth between the game logic and the renderer every single frame, managing the JS/WASM bridge becomes a headache and a performance bottleneck.
3. **Targeting low-end mobile devices is priority #1.** Minimizing initial download sizes (WASM binaries can be large) and memory overhead is critical here. Pure JS is more lightweight.

### Introduce Rust/WASM (e.g., `@react-three/rapier`) IF:
1. **You need robust, complex physics.** If your game relies on accurate rigid body dynamics, joints, and hundreds of colliding objects (like a modern 3D puzzle game or a vehicle simulator), JavaScript physics engines (like Cannon.js) will struggle to maintain framerates on mobile. A WASM physics engine like Rapier is essential here.
2. **You have heavy background computation.** Tasks like procedural generation of massive worlds, complex AI routines, or processing large streams of networking data (like your CRDT sync) are perfectly suited for Rust/WASM.
3. **You can batch updates.** If you can ask the WASM module for an array of all object positions *once* per frame, rather than asking for them one by one, you minimize the bridge overhead and reap the benefits of Rust's speed.

**Summary Recommendation for Mobile:** Start with Three.js. Only introduce heavy WASM libraries (like Rapier for physics) when profiling shows that pure JavaScript logic is causing your framerate to drop, and ensure you carefully monitor the linear memory footprint to avoid mobile browser crashes.