import { defineConfig } from 'vitest/config';
import path from 'path';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
    plugins: [wasm()],
    test: {
        environment: 'node',
        alias: {
            'tf-engine': path.resolve(__dirname, 'node_modules/tf-engine/dist/index.js')
        },
        server: {
            deps: {
                // Force Vitest to run @tf-engine/core through Vite's transform
                // pipeline so vite-plugin-wasm can handle the .wasm import.
                // Without this, node_modules are loaded raw by Node.js and .wasm
                // imports fail with "Unknown file extension".
                inline: ['@tf-engine/core', '@nexus-physics/core'],
            },
        },
    },
});
