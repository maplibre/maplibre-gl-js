import * as esbuild from 'esbuild';
import {copyFileSync, existsSync, mkdirSync} from 'fs';

const workerSrc = 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs';

if (!existsSync(workerSrc)) {
    console.error(
        `\nWorker file not found at:\n  ${workerSrc}\n\n` +
        'Run `npm run build-dist` (or `npm run build-prod`) in the repo root ' +
        'to produce the production maplibre-gl bundles, then retry.\n'
    );
    process.exit(1);
}

await esbuild.build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    outdir: 'dist',
    format: 'esm',
    sourcemap: true
});

mkdirSync('dist', {recursive: true});
copyFileSync(workerSrc, 'dist/maplibre-gl-worker.mjs');
