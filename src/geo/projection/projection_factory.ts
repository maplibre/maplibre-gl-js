import {warnOnce} from '../../util/util';
import {MercatorProjection} from './mercator_projection';
import {MercatorTransform} from './mercator_transform';
import {MercatorCameraHelper} from './mercator_camera_helper';
import {VerticalPerspectiveProjection} from './vertical_perspective_projection';
import {GlobeTransform} from './globe_transform';
import {VerticalPerspectiveCameraHelper} from './vertical_perspective_camera_helper';
import {VerticalPerspectiveTransform} from './vertical_perspective_transform';
import {GlobeProjection} from './globe_projection';
import {GlobeCameraHelper} from './globe_camera_helper';

import type {ProjectionSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Projection} from './projection';
import type {ITransform} from '../transform_interface';
import type {ICameraHelper} from './camera_helper';

export function createProjectionFromName(name: ProjectionSpecification['type']): {
    projection: Projection;
    transform: ITransform;
    cameraHelper: ICameraHelper;
} {
    switch (name) {
        case 'mercator':
        {
            return {
                projection: new MercatorProjection(),
                transform: new MercatorTransform(),
                cameraHelper: new MercatorCameraHelper(),
            };
        }
        case 'globe':
        {
            const globeProjection = new GlobeProjection({type: [
                'interpolate',
                ['linear'],
                ['zoom'],
                10,
                'vertical-perspective',
                12,
                'mercator'
            ]});
            return {
                projection: globeProjection,
                transform: new GlobeTransform(),
                cameraHelper: new GlobeCameraHelper(globeProjection),
            };
        }
        case 'vertical-perspective':
        {
            return {
                projection: new VerticalPerspectiveProjection(),
                transform: new VerticalPerspectiveTransform(),
                cameraHelper: new VerticalPerspectiveCameraHelper(),
            };
        }
        default:
        {
            warnOnce(`Unknown projection name: ${name}. Falling back to mercator projection.`);
            return {
                projection: new MercatorProjection(),
                transform: new MercatorTransform(),
                cameraHelper: new MercatorCameraHelper(),
            };
        }
    }
}
