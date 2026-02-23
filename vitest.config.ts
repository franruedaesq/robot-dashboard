import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        alias: {
            'tf-engine': path.resolve(__dirname, 'node_modules/tf-engine/dist/index.js')
        }
    },
});
