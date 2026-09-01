import {simpleCrs, type CrsDefinition} from './planar_projection.ts';
import type {ProjectionSpecification} from '@maplibre/maplibre-gl-style-spec';

const BUILT_IN_PROJECTION_NAMES = ['mercator', 'globe', 'vertical-perspective'];

const registeredProjections: Record<string, CrsDefinition> = {simple: simpleCrs};

/**
 * @internal
 * Returns the registered CRS definition for a projection name, or `undefined` if the name is not registered
 * (an unset or expression-valued projection type is never registered).
 */
export function getRegisteredProjection(name: ProjectionSpecification['type']): CrsDefinition | undefined {
    return typeof name === 'string' ? registeredProjections[name] : undefined;
}

/**
 * Registers a planar coordinate reference system so it can be used as a map projection.
 * After registration the CRS name is accepted by `map.setProjection({type: name})` and by the
 * style's `projection.type`. Every source of such a map is expected to serve tiles in the CRS's
 * own quad tile grid, described by `tileMatrix`; the map does not reproject tile content.
 * The pre-registered `'simple'` projection is an identity CRS over lng/lat degrees, where tile 0/0/0
 * spans -90..90 on both axes.
 *
 * A map in a registered projection never renders world copies and never wraps across an antimeridian.
 *
 * @param def - the CRS definition
 * @throws Error if the name is already registered or is one of the built-in projections, or if `tileMatrix.extentAtZoom0` is not positive
 * @example
 * ```ts
 * // NZTM2000 (EPSG:2193) with the LINZ NZTM2000Quad tile matrix set, using proj4js for the math.
 * // The origin and extent below come from the NZTM2000Quad TileMatrixSet definition;
 * // copy them from that definition rather than from this example.
 * proj4.defs('EPSG:2193', '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +units=m +no_defs');
 * addProjection({
 *     name: 'EPSG:2193',
 *     project: (lng, lat) => proj4('EPSG:4326', 'EPSG:2193', [lng, lat]),
 *     unproject: (x, y) => proj4('EPSG:2193', 'EPSG:4326', [x, y]),
 *     tileMatrix: {
 *         origin: [-3260586.7284, 10438190.1652], // top-left of tile 0/0/0, from the NZTM2000Quad TileMatrixSet
 *         extentAtZoom0: 10018754.1714 // width of tile 0/0/0 in meters, from the NZTM2000Quad TileMatrixSet
 *     }
 * });
 * map.setProjection({type: 'EPSG:2193'});
 * ```
 */
export function addProjection(def: CrsDefinition): void {
    if (BUILT_IN_PROJECTION_NAMES.includes(def.name)) {
        throw new Error(`A projection called "${def.name}" is built in and cannot be replaced.`);
    }
    if (registeredProjections[def.name]) {
        throw new Error(`A projection called "${def.name}" already exists.`);
    }
    if (!(def.tileMatrix.extentAtZoom0 > 0)) {
        throw new Error(`The projection "${def.name}" needs a tileMatrix.extentAtZoom0 greater than zero.`);
    }
    registeredProjections[def.name] = def;
}

/**
 * Removes a projection registered with {@link addProjection}. Maps currently using it keep working
 * until their projection changes; the pre-registered `'simple'` projection can be removed too.
 *
 * @param name - the name the projection was registered with
 * @example
 * ```ts
 * removeProjection('EPSG:2193');
 * ```
 */
export function removeProjection(name: string): void {
    delete registeredProjections[name];
}
