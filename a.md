# Mobile Web Browser Feasibility Report

## Overview
This report evaluates the feasibility of running the current project on mobile web browsers (e.g., iOS Safari, Android Chrome). The project relies heavily on 3D rendering (`three`, `@react-three/fiber`) and several libraries that execute Rust code compiled to WebAssembly (WASM), such as `@react-three/rapier` (physics), CRDT synchronization (`@crdt-sync`), and various spatial/TF engines.

While modern mobile browsers are incredibly capable, running complex Rust/WASM-based applications alongside WebGL rendering presents several unique challenges.

---

## 1. WebAssembly (WASM) Support
**Verdict:** Supported.
Modern mobile browsers (iOS Safari 11+, Chrome for Android 57+) have excellent, native support for WebAssembly. The Rust code compiled to WASM will execute correctly without requiring polyfills.

## 2. Memory Constraints (The Biggest Hurdle)
**Verdict:** High Risk.
Mobile browsers impose strict memory limits on individual tabs to ensure OS stability.
* **iOS Safari:** Historically, Safari will forcefully crash and reload a tab ("This webpage was reloaded because it was using significant memory") if it exceeds device-specific limits (often around 1GB - 2GB on newer iPhones, and much lower on older devices).
* **WASM Memory Allocation:** WebAssembly requires contiguous blocks of memory. If libraries like Rapier or the spatial engines allocate large chunks of memory for simulations, or if CRDT document histories grow indefinitely, the application can easily hit these limits and crash.

## 3. CPU Performance and Thermal Throttling
**Verdict:** Moderate Risk.
* **Performance:** Rust/WASM is highly performant and runs at near-native speeds. Mobile CPUs (like Apple's A-series or Qualcomm Snapdragons) are very powerful and can handle complex calculations.
* **Thermal Throttling:** Running a physics engine (`@react-three/rapier`), processing spatial transforms, and syncing CRDTs in real-time is computationally expensive. Sustained 100% CPU/GPU usage will cause the phone to heat up. Once a phone gets too hot, the OS will aggressively throttle CPU and GPU performance, leading to a massive drop in frames per second (FPS) and a laggy experience.

## 4. Battery Consumption
**Verdict:** High Impact.
The combination of continuous WebGL rendering (Three.js) and heavy WASM background computation (physics, CRDTs, TF trees) will drain a mobile device's battery very rapidly. Users typically do not tolerate websites that cause noticeable battery drain.

## 5. Network and Load Times
**Verdict:** Moderate Risk.
WASM binaries compiled from Rust can be large (often several megabytes).
* On mobile networks (3G/4G/5G), downloading large `.wasm` files, alongside 3D assets (meshes, URDFs, textures), can lead to long initial load times.
* Caching strategies and aggressive compression (like gzip or Brotli) are essential to mitigate this.

## 6. WebGL and GPU Limitations
**Verdict:** Moderate Risk.
While mobile GPUs are powerful, they have less video memory (VRAM) and lower fill rates than desktop GPUs. Rendering complex robot models with high polygon counts, alongside physics debug visuals, might cause low framerates.

---

## Conclusion
**Can this project run in a phone web browser?**
**Yes, technically it can.** Modern mobile browsers support all the underlying technologies (WASM, WebGL).

**However, without significant optimization, the user experience may be poor.** The application is at a high risk of crashing due to Out-Of-Memory (OOM) errors on iOS Safari, overheating the device, and draining the battery quickly.

### Recommendations for Mobile Optimization:
1. **Memory Management:** Carefully monitor WASM memory usage. Ensure that physics objects and CRDT histories are cleaned up when no longer needed.
2. **Asset Optimization:** Decimate 3D robot meshes and use compressed textures for mobile clients.
3. **Physics Throttling:** Reduce the physics simulation tick rate or the complexity of collision meshes for mobile users.
4. **Lazy Loading:** Dynamically import heavy WASM modules and 3D assets only when required.
5. **Battery Save Mode:** Implement a "low power mode" that caps framerates to 30 FPS and reduces physics fidelity on mobile devices.
