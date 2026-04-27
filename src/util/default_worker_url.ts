/**
 * Default URL for the worker bundle, resolved as a sibling of the currently
 * loaded module via `import.meta.url`.
 *
 * Modern bundlers (Vite, webpack 5+, Rollup) recognize the static
 * `new URL('./literal-string', import.meta.url)` pattern at build time, bundle
 * the referenced file as a static asset, and rewrite the URL to point at the
 * bundled location. Direct browser ESM (e.g. `<script type="module">`
 * importing from a CDN) gets the right URL too: `import.meta.url` is the URL
 * of the loaded `.mjs` file, and the worker is its sibling on disk.
 *
 * In the UMD bundle this value is irrelevant. `setWorkerUrl(blobUrl)` is
 * called from `build/rollup/bundle_prelude.js` at module-init time and
 * overwrites whatever default we computed here.
 *
 * `setWorkerUrl()` remains the escape hatch for any environment where this
 * detection doesn't produce the right URL (custom CDN paths, cross-origin
 * worker hosting, local maplibre-gl development referencing the `-dev`
 * worker, etc.).
 */
export const defaultWorkerUrl: string = (() => {
    try {
        return new URL('./maplibre-gl-worker.mjs', import.meta.url).href;
    } catch {
        return '';
    }
})();
