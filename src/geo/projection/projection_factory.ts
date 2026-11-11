import {warnOnce} from '../../util/util.ts';
import {MercatorProjection} from './mercator_projection.ts';
import {MercatorCameraHelper} from './mercator_camera_helper.ts';
import {GlobeProjection} from './globe_projection.ts';
import {VerticalPerspectiveCameraHelper} from './vertical_perspective_camera_helper.ts';
import {createGlobeCameraProjection, createMercatorCameraProjection, createVerticalPerspectiveCameraProjection, renderedProjection, type CameraProjection} from './camera_projection.ts';
import {VerticalPerspectiveProjection} from './vertical_perspective_projection.ts';
import {CRSWorldCoordinateHelper} from './crs.ts';
import {getRegisteredProjection} from './projection_crud.ts';

import type {ProjectionSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Projection} from './projection.ts';
import type {ICameraHelper} from './camera_helper.ts';

const mercatorCameraHelper = new MercatorCameraHelper();
const verticalPerspectiveCameraHelper = new VerticalPerspectiveCameraHelper();

/**
 * @internal
 * The camera controls of the projection a camera is drawn with: a globe is turned while it renders as a globe and
 * moved like mercator once it has turned into mercator.
 */
export function getCameraHelper(projection: CameraProjection): ICameraHelper {
    return renderedProjection(projection).kind === 'vertical-perspective' ? verticalPerspectiveCameraHelper : mercatorCameraHelper;
}

/**
 * @internal
 * The style projection of a projection name or expression, and the projection the camera is drawn with in it.
 */
export function createProjectionFromName(name: ProjectionSpecification['type'], globalState: Record<string, any>): {
    projection: Projection;
    cameraProjection: CameraProjection;
} {
    if (Array.isArray(name)) {
        const registeredName = findRegisteredProjectionName(name);
        if (registeredName) {
            warnOnce(`Projection expressions cannot use the registered projection "${registeredName}", which only works as a plain name. Falling back to the globe projection.`);
        }
        const globeProjection = new GlobeProjection({type: name}, globalState);
        return {
            projection: globeProjection,
            cameraProjection: createGlobeCameraProjection(),
        };
    }
    const registered = getRegisteredProjection(name);
    if (registered) {
        const worldCoordinateHelper = new CRSWorldCoordinateHelper(registered);
        return {
            projection: new MercatorProjection(worldCoordinateHelper),
            cameraProjection: createMercatorCameraProjection(worldCoordinateHelper),
        };
    }
    switch (name) {
        case 'mercator':
        {
            return {
                projection: new MercatorProjection(),
                cameraProjection: createMercatorCameraProjection(),
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
            ]}, {});
            return {
                projection: globeProjection,
                cameraProjection: createGlobeCameraProjection(),
            };
        }
        case 'vertical-perspective':
        {
            return {
                projection: new VerticalPerspectiveProjection(),
                cameraProjection: createVerticalPerspectiveCameraProjection(),
            };
        }
        default:
        {
            warnOnce(`Unknown projection name: ${name}. Falling back to mercator projection.`);
            return {
                projection: new MercatorProjection(),
                cameraProjection: createMercatorCameraProjection(),
            };
        }
    }
}

/**
 * The first registered projection named anywhere in a projection expression, or `undefined` if it names none.
 */
function findRegisteredProjectionName(expression: unknown[]): string | undefined {
    return expression.flat(Infinity).find((item): item is string => typeof item === 'string' && getRegisteredProjection(item) !== undefined);
}
