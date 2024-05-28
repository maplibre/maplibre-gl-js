import {warnOnce} from '../../util/util';
import {Projection} from './projection';
import {Transform} from '../transform';
import {GlobeProjection} from './globe';
import {GlobeTransform} from './globe_transform';
import {MercatorProjection} from './mercator';
import {MercatorTransform} from './mercator_transform';

/**
 * Name of MapLibre's map projection. Can be:
 *
 * - `mercator` - A classic Web Mercator 2D map
 * - 'globe' - A 3D spherical view of the planet when zoomed out, transitioning seamlessly to Web Mercator at high zoom levels.
 */
export type ProjectionName = 'mercator' | 'globe';

export function createProjectionFromName(name: ProjectionName): {
    projection: Projection;
    transform: Transform;
} {
    switch (name) {
        case 'mercator':
        {
            return {
                projection: new MercatorProjection(),
                transform: new MercatorTransform()
            };
        }
        case 'globe':
        {
            const proj = new GlobeProjection();
            return {
                projection: proj,
                transform: new GlobeTransform(proj)
            };
        }
        default:
        {
            warnOnce(`Unknown projection name: ${name}. Falling back to mercator projection.`);
            return {
                projection: new MercatorProjection(),
                transform: new MercatorTransform()
            };
        }
    }
}
