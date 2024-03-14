import {warnOnce} from '../../util/util';
import {GlobeProjection} from './globe';
import {MercatorProjection} from './mercator';
import {ProjectionBase} from './projection_base';

/**
 * Name of MapLibre's map projection. Can be:
 *
 * - `mercator` - A classic Web Mercator 2D map
 * - 'globe' - A 3D spherical view of the planet when zoomed out, transitioning seamlessly to Web Mercator at high zoom levels.
 */
export type ProjectionName = 'mercator' | 'globe';

export function createProjectionFromName(name: ProjectionName): ProjectionBase {
    switch (name) {
        case 'mercator':
            return new MercatorProjection();
        case 'globe':
            return new GlobeProjection();
        default:
            warnOnce(`Unknown projection name: ${name}. Falling back to mercator projection.`);
            return new MercatorProjection();
    }
}
