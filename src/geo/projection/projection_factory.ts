import {warnOnce} from '../../util/util.ts';
import {MercatorProjection} from './mercator_projection.ts';
import {createMercatorTransform} from './mercator_transform.ts';
import {GlobeProjection} from './globe_projection.ts';
import {createGlobeTransform} from './globe_transform.ts';
import {createVerticalPerspectiveTransform} from './vertical_perspective_transform.ts';
import {VerticalPerspectiveProjection} from './vertical_perspective_projection.ts';
import {CRSWorldCoordinateHelper} from './crs.ts';
import {getRegisteredProjection} from './projection_crud.ts';

import type {ProjectionSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Projection} from './projection.ts';
import type {ITransform} from '../transform_interface.ts';
import type {TransformConstrainFunction} from '../../camera/camera_types.ts';
import type {CameraProjectionKind} from '../../camera/camera_context.ts';

/**
 * @internal
 * The style projection of a projection name or expression, and the projection the camera is projected with in it.
 * The camera's world mapping is the style projection's, see {@link Projection.worldCoordinateHelper}.
 */
export function createProjectionFromName(name: ProjectionSpecification['type'], transformConstrain: TransformConstrainFunction | undefined, globalState: Record<string, any>): {
    projection: Projection;
    transform: ITransform;
    cameraProjection: CameraProjectionKind;
} {
    const transformOptions = {constrainOverride: transformConstrain};
    if (Array.isArray(name)) {
        const registeredName = findRegisteredProjectionName(name);
        if (registeredName) {
            warnOnce(`Projection expressions cannot use the registered projection "${registeredName}", which only works as a plain name. Falling back to the globe projection.`);
        }
        const globeProjection = new GlobeProjection({type: name}, globalState);
        return {
            projection: globeProjection,
            transform: createGlobeTransform(transformOptions),
            cameraProjection: 'globe',
        };
    }
    const registered = getRegisteredProjection(name);
    if (registered) {
        const worldCoordinateHelper = new CRSWorldCoordinateHelper(registered);
        return {
            projection: new MercatorProjection(worldCoordinateHelper),
            transform: createMercatorTransform({...transformOptions, worldCoordinateHelper}),
            cameraProjection: 'mercator',
        };
    }
    switch (name) {
        case 'mercator':
        {
            return {
                projection: new MercatorProjection(),
                transform: createMercatorTransform(transformOptions),
                cameraProjection: 'mercator',
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
                transform: createGlobeTransform(transformOptions),
                cameraProjection: 'globe',
            };
        }
        case 'vertical-perspective':
        {
            return {
                projection: new VerticalPerspectiveProjection(),
                transform: createVerticalPerspectiveTransform(transformOptions),
                cameraProjection: 'vertical-perspective',
            };
        }
        default:
        {
            warnOnce(`Unknown projection name: ${name}. Falling back to mercator projection.`);
            return {
                projection: new MercatorProjection(),
                transform: createMercatorTransform(transformOptions),
                cameraProjection: 'mercator',
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
