import {CRSWorldCoordinateHelper, identityCrs, type CRSDefinition} from '../geo/projection/crs.ts';

/**
 * Builds the converter for a coordinate reference system from its WKT, the way `proj4(wkt)` does: `forward` takes
 * lng/lat to CRS coordinates and `inverse` takes them back. A worker script sets one with
 * `self.setProjectionHandler`, loaded through {@link importScriptInWorkers}, so that GeoJSON sources follow a
 * registered projection whose definition carries a `wkt`.
 */
export type ProjectionHandler = (wkt: string) => CRSDefinition['projection'];

let projectionHandler: ProjectionHandler | null = null;

/**
 * @internal
 * Sets the worker's projection handler; a later call replaces it, and `null` removes it.
 */
export function setProjectionHandler(handler: ProjectionHandler | null): void {
    projectionHandler = handler;
}

/**
 * @internal
 * The world coordinate helper a worker builds for a registered projection the main thread describes: from the
 * definition's WKT through the projection handler, or the built-in identity CRS when there is no WKT. `null` when a
 * WKT comes with no handler set.
 */
export function createWorkerCRSHelper(crs: Pick<CRSDefinition, 'name' | 'wkt' | 'tileMatrixSet'>): CRSWorldCoordinateHelper | null {
    if (!crs.wkt) return new CRSWorldCoordinateHelper(identityCrs);
    if (!projectionHandler) return null;
    return new CRSWorldCoordinateHelper({name: crs.name, wkt: crs.wkt, projection: projectionHandler(crs.wkt), tileMatrixSet: crs.tileMatrixSet});
}
