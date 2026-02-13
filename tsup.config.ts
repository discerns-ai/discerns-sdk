import { defineConfig } from 'tsup';

export default defineConfig([
    // Main JS bundle (no React)
    {
        entry: {
            index: 'js/index.ts',
        },
        format: ['esm', 'cjs'],
        dts: true,
        sourcemap: true,
        clean: true,
        external: ['zod', 'zod/v4', 'zod/v4/core'],
        treeshake: true,
    },
    // React bundle (includes React component)
    {
        entry: {
            react: 'react/DiscernsChatbot.tsx',
        },
        format: ['esm', 'cjs'],
        dts: true,
        sourcemap: true,
        external: ['react', 'react-dom', 'zod', 'zod/v4', 'zod/v4/core'],
        treeshake: true,
        esbuildOptions(options) {
            options.jsx = 'automatic';
        },
    },
]);

