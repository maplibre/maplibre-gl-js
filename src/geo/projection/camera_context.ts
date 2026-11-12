import {mercatorWorldCoordinateHelper} from '../mercator_coordinate.ts';

import type {TransformConstrainFunction, WorldCoordinateHelper} from '../camera_types.ts';

/**
 * @internal
 * The projection a camera is projected with: mercator, which also places a registered planar CRS; the vertical
 * perspective, a globe seen from a point in space; or the globe, which draws with the vertical perspective at low zoom
 * and turns into mercator as it zooms in.
 */
export type CameraProjectionKind = 'mercator' | 'vertical-perspective' | 'globe';

/**
 * @internal
 * What a camera's view state is projected and constrained with: the projection and how far a globe has turned into
 * the vertical perspective, which are data the camera's state holds, and the lng/lat to world coordinate mapping and
 * the constrain the map was given, which the camera holds but does not own. See `Camera.context`.
 */
export type CameraContext = {
    readonly projection: CameraProjectionKind;
    /** How far a globe is between mercator, at 0, and the vertical perspective, at 1. Other projections ignore it. */
    readonly projectionTransition: number;
    /** The camera's lng/lat to world coordinate mapping: mercator's own, or that of a registered planar CRS. */
    readonly worldCoordinateHelper: WorldCoordinateHelper;
    /** The function the map was given to constrain the camera with instead of the projection's own, or null. */
    readonly constrainOverride: TransformConstrainFunction | null;
};

/** @internal Creates a camera context: by default mercator, with a globe fully a globe, and no constrain override. */
export function createCameraContext(context: Partial<CameraContext> = {}): CameraContext {
    return {
        projection: context.projection ?? 'mercator',
        projectionTransition: context.projectionTransition ?? 1,
        worldCoordinateHelper: context.worldCoordinateHelper ?? mercatorWorldCoordinateHelper,
        constrainOverride: context.constrainOverride ?? null,
    };
}

/**
 * @internal
 * The projection a camera is drawn with: its own, or for a globe the vertical perspective while it renders as a globe
 * and mercator once it has turned into mercator.
 */
export function renderedProjection(context: CameraContext): 'mercator' | 'vertical-perspective' {
    if (context.projection !== 'globe') return context.projection;
    return context.projectionTransition > 0 ? 'vertical-perspective' : 'mercator';
}

/**
 * @internal
 * Whether the camera is moved by turning a globe rather than over a plane: on the vertical perspective, and on a globe
 * while it renders as one.
 */
export function usesGlobeControls(context: CameraContext): boolean {
    return renderedProjection(context) === 'vertical-perspective';
}
