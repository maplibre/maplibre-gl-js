/**
 * The id a benchmark bundle registers its benchmarks under.
 *
 * The comparison page loads published bundles cross-origin from gh-pages and
 * the working-directory bundle from the page's own origin. Both bake their
 * version id from `git describe` at build time, so a local checkout at the
 * same commit a published bundle was built from would register under the same
 * id and silently replace it. Tagging the same-origin bundle keeps them apart.
 */
export function benchmarkVersionId(bakedVersion: string, bundleOrigin: string, pageOrigin: string): string {
    return bundleOrigin === pageOrigin ? `${bakedVersion} (local)` : bakedVersion;
}
