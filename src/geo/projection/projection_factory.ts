import {ProjectionSpecification} from '@maplibre/maplibre-gl-style-spec';
import {warnOnce} from '../../util/util';
import {GlobeProjection} from './globe';
import {MercatorProjection} from './mercator';
import {Projection} from './projection';

export function createProjectionFromName(name: ProjectionSpecification['type']): Projection {
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
