import {identityCrs, type CRS} from './crs.ts';

import type {ProjectionSpecification} from '@maplibre/maplibre-gl-style-spec';

const registeredProjections = new Map<string, CRS>([[identityCrs.name, identityCrs]]);

/**
 * @internal
 * Returns the registered CRS for a projection name, or `undefined` if the name is not registered
 * (an unset or expression-valued projection type is never registered).
 */
export function getRegisteredProjection(name: ProjectionSpecification['type']): CRS | undefined {
    return typeof name === 'string' ? registeredProjections.get(name) : undefined;
}

/**
 * @experimental
 * Registers a planar coordinate reference system so it can be used as a map projection.
 * After registration the CRS name is accepted, as a plain name, by the style's `projection.type` and by
 * `map.setProjection({type: name})`. Every tile source of such a map is taken to be cut in the quad tile grid
 * described by `tileMatrixSet`, and the map does not reproject tile content.
 * The pre-registered `'identity'` projection is an identity CRS over lng/lat degrees, where tile 0/0/0
 * spans -90..90 on both axes. The name of a registered CRS needs a colon, like `'EPSG:2193'` or
 * `'custom:floor-plan'`: names without one are reserved for built-in projections.
 *
 * A map in a registered projection never renders world copies and never wraps across an antimeridian.
 *
 * @param crs - the CRS
 * @throws Error if the name has no colon, is already registered, or if `tileMatrixSet.extentAtZoom0` is not positive
 * @example
 * ```ts
 * // NZTM2000 (EPSG:2193) with the LINZ NZTM2000Quad tile matrix set, using proj4js for the math.
 * // The origin and extent below come from the NZTM2000Quad TileMatrixSet definition;
 * // copy them from that definition rather than from this example.
 * proj4.defs('EPSG:2193', '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +units=m +no_defs');
 * addProjection({
 *     name: 'EPSG:2193',
 *     projection: proj4('EPSG:4326', 'EPSG:2193'),
 *     tileMatrixSet: {
 *         origin: [-3260586.7284, 10438190.1652], // top-left of tile 0/0/0, from the NZTM2000Quad TileMatrixSet
 *         extentAtZoom0: 10018754.1714 // width of tile 0/0/0 in meters, from the NZTM2000Quad TileMatrixSet
 *     }
 * });
 * const map = new Map({
 *     container: 'map',
 *     style: {version: 8, projection: {type: 'EPSG:2193'}, sources: {}, layers: []}
 * });
 * ```
 */
export function addProjection(crs: CRS): void {
    if (!crs.name.includes(':')) {
        throw new Error(`The projection name "${crs.name}" needs a colon, like "EPSG:2193" or "custom:equal-earth": names without one are reserved for built-in projections.`);
    }
    if (registeredProjections.has(crs.name)) {
        throw new Error(`A projection called "${crs.name}" already exists.`);
    }
    if (!(crs.tileMatrixSet.extentAtZoom0 > 0)) {
        throw new Error(`The projection "${crs.name}" needs a tileMatrixSet.extentAtZoom0 greater than zero.`);
    }
    registeredProjections.set(crs.name, crs);
}

/**
 * @experimental
 * Removes a projection registered with {@link addProjection}. Maps currently using it keep working
 * until their projection changes. Built-in projections, whose names have no colon, cannot be removed.
 *
 * @param name - the name the projection was registered with
 * @throws Error if the name has no colon
 * @example
 * ```ts
 * removeProjection('EPSG:2193');
 * ```
 */
export function removeProjection(name: string): void {
    if (!name.includes(':')) {
        throw new Error(`The projection name "${name}" has no colon, so it is reserved for built-in projections, which cannot be removed.`);
    }
    registeredProjections.delete(name);
}
