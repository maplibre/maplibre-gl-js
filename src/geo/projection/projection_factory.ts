import {warnOnce} from '../../util/util.ts';
import {MercatorProjection} from './mercator_projection.ts';
import {MercatorTransform} from './mercator_transform.ts';
import {MercatorCameraHelper} from './mercator_camera_helper.ts';
import {GlobeProjection} from './globe_projection.ts';
import {GlobeTransform} from './globe_transform.ts';
import {GlobeCameraHelper} from './globe_camera_helper.ts';
import {VerticalPerspectiveCameraHelper} from './vertical_perspective_camera_helper.ts';
import {VerticalPerspectiveTransform} from './vertical_perspective_transform.ts';
import {VerticalPerspectiveProjection} from './vertical_perspective_projection.ts';

import type {ProjectionSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Projection} from './projection.ts';
import type {ITransform, TransformConstrainFunction} from '../transform_interface.ts';
import type {ICameraHelper} from './camera_helper.ts';

export function createProjectionFromName(name: ProjectionSpecification['type'], transformConstrain?: TransformConstrainFunction): {
    projection: Projection;
    transform: ITransform;
    cameraHelper: ICameraHelper;
} {
    const transformOptions = {constrainOverride: transformConstrain};
    if (Array.isArray(name)) {
        const globeProjection = new GlobeProjection({type: name});
        return {
            projection: globeProjection,
            transform: new GlobeTransform(transformOptions),
            cameraHelper: new GlobeCameraHelper(globeProjection),
        };
    }
    switch (name) {
        case 'mercator':
        {
            return {
                projection: new MercatorProjection(),
                transform: new MercatorTransform(transformOptions),
                cameraHelper: new MercatorCameraHelper(),
            };
        }
        case 'globe':
        {
            const globeProjection = new GlobeProjection({type: [
                'interpolate',
                ['linear'],
                ['zoom'],
                11,
                'vertical-perspective',
                12,
                'mercator'
            ]});
            return {
                projection: globeProjection,
                transform: new GlobeTransform(transformOptions),
                cameraHelper: new GlobeCameraHelper(globeProjection),
            };
        }
        case 'vertical-perspective':
        {
            return {
                projection: new VerticalPerspectiveProjection(),
                transform: new VerticalPerspectiveTransform(transformOptions),
                cameraHelper: new VerticalPerspectiveCameraHelper(),
            };
        }
        default:
        {
            warnOnce(`Unknown projection name: ${name}. Falling back to mercator projection.`);
            return {
                projection: new MercatorProjection(),
                transform: new MercatorTransform(transformOptions),
                cameraHelper: new MercatorCameraHelper(),
            };
        }
    }
}
