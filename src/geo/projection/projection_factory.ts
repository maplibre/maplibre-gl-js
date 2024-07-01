import {ProjectionSpecification} from '@maplibre/maplibre-gl-style-spec';
import {warnOnce} from '../../util/util';
import {Projection} from './projection';
import {GlobeProjection} from './globe';
import {MercatorProjection} from './mercator';
import {Transform} from '../transform';
import {MercatorTransform} from './mercator_transform';
import {GlobeTransform} from './globe_transform';

export function createProjectionFromName(name: ProjectionSpecification['type']): {
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
