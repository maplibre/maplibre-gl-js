import {CRSWorldCoordinateHelper, identityCrs, type CRSDefinition} from '../geo/projection/crs.ts';

/**
 * Builds the converter for a coordinate reference system from its WKT, the way `proj4(wkt)` does: `forward` takes
 * lng/lat to CRS coordinates and `inverse` takes them back. A worker script registers one with
 * `self.registerProjectionPlugin`, loaded through {@link importScriptInWorkers}, so that GeoJSON sources follow a
 * registered projection whose definition carries a `wkt`.
 */
export type ProjectionPlugin = (wkt: string) => CRSDefinition['projection'];

let projectionPlugin: ProjectionPlugin | null = null;

/**
 * @internal
 * Registers the worker's projection plugin; a later call replaces it, and `null` removes it.
 */
export function setProjectionPlugin(plugin: ProjectionPlugin | null): void {
    projectionPlugin = plugin;
}

/**
 * @internal
 * The world coordinate helper a worker builds for a registered projection the main thread describes: from the
 * definition's WKT through the projection plugin, or the built-in identity CRS when there is no WKT. `null` when a
 * WKT comes with no plugin registered.
 */
export function createWorkerCRSHelper(crs: Pick<CRSDefinition, 'name' | 'wkt' | 'tileMatrixSet'>): CRSWorldCoordinateHelper | null {
    if (!crs.wkt) return new CRSWorldCoordinateHelper(identityCrs);
    if (!projectionPlugin) return null;
    return new CRSWorldCoordinateHelper({name: crs.name, wkt: crs.wkt, projection: projectionPlugin(crs.wkt), tileMatrixSet: crs.tileMatrixSet});
}
