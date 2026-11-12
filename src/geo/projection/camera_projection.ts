import {mercatorWorldCoordinateHelper} from '../mercator_coordinate.ts';
import {MercatorCoveringTilesDetailsProvider} from './mercator_covering_tiles_details_provider.ts';
import {GlobeCoveringTilesDetailsProvider} from './globe_covering_tiles_details_provider.ts';

import type {WorldCoordinateHelper} from '../camera_types.ts';
import type {CoveringTilesDetailsProvider} from './covering_tiles_details_provider.ts';

/**
 * @internal
 * What a camera is projected with besides its {@link CameraState}: the projection, the lng/lat to world coordinate
 * mapping the camera is positioned in, and the details of the projection's tile grid. The style's projection sets it,
 * not the changes to the camera, so it is not part of the camera's state. It is immutable: a globe that moves between
 * its projections hands out a new one, see {@link withGlobeness}.
 */
export type CameraProjection = MercatorCameraProjection | VerticalPerspectiveCameraProjection | GlobeCameraProjection;

/** @internal The mercator {@link CameraProjection}, which also places a registered planar CRS. */
export type MercatorCameraProjection = {
    readonly kind: 'mercator';
    readonly worldCoordinateHelper: WorldCoordinateHelper;
    readonly coveringTilesDetailsProvider: CoveringTilesDetailsProvider;
};

/** @internal The vertical perspective {@link CameraProjection} of a globe without its transition into mercator. */
export type VerticalPerspectiveCameraProjection = {
    readonly kind: 'vertical-perspective';
    readonly worldCoordinateHelper: WorldCoordinateHelper;
    readonly coveringTilesDetailsProvider: CoveringTilesDetailsProvider;
};

/**
 * @internal
 * The globe {@link CameraProjection}, which draws with the vertical perspective and turns into mercator at high zoom
 * levels.
 */
export type GlobeCameraProjection = {
    readonly kind: 'globe';
    readonly worldCoordinateHelper: WorldCoordinateHelper;
    /** How far the globe is between mercator, at 0, and the vertical perspective, at 1. */
    readonly globeness: number;
    readonly mercator: MercatorCameraProjection;
    readonly verticalPerspective: VerticalPerspectiveCameraProjection;
};

/** @internal The mercator {@link CameraProjection} of a world mapping, by default mercator's own. */
export function createMercatorCameraProjection(worldCoordinateHelper: WorldCoordinateHelper = mercatorWorldCoordinateHelper): MercatorCameraProjection {
    return {kind: 'mercator', worldCoordinateHelper, coveringTilesDetailsProvider: new MercatorCoveringTilesDetailsProvider()};
}

/** @internal The vertical perspective {@link CameraProjection}. */
export function createVerticalPerspectiveCameraProjection(): VerticalPerspectiveCameraProjection {
    return {kind: 'vertical-perspective', worldCoordinateHelper: mercatorWorldCoordinateHelper, coveringTilesDetailsProvider: new GlobeCoveringTilesDetailsProvider()};
}

/** @internal The globe {@link CameraProjection}, fully a globe until its transition says otherwise. */
export function createGlobeCameraProjection(): GlobeCameraProjection {
    return {
        kind: 'globe',
        worldCoordinateHelper: mercatorWorldCoordinateHelper,
        globeness: 1,
        mercator: createMercatorCameraProjection(),
        verticalPerspective: createVerticalPerspectiveCameraProjection(),
    };
}

/**
 * @internal
 * The projection a frame draws with, where a globe is `globeness` of the way from mercator to the vertical
 * perspective; the same projection where nothing changes.
 */
export function withGlobeness(projection: CameraProjection, globeness: number): CameraProjection {
    if (projection.kind !== 'globe' || projection.globeness === globeness) return projection;
    return {...projection, globeness};
}

/**
 * @internal
 * The projection a camera is drawn with: its own, or for a globe the vertical perspective while it renders as a globe
 * and mercator once it has turned into mercator.
 */
export function renderedProjection(projection: CameraProjection): MercatorCameraProjection | VerticalPerspectiveCameraProjection {
    if (projection.kind !== 'globe') return projection;
    return projection.globeness > 0 ? projection.verticalPerspective : projection.mercator;
}

/**
 * @internal
 * Whether the camera is moved by turning a globe rather than over a plane: on the vertical perspective, and on a globe
 * while it renders as one.
 */
export function usesGlobeControls(projection: CameraProjection): boolean {
    return renderedProjection(projection).kind === 'vertical-perspective';
}
