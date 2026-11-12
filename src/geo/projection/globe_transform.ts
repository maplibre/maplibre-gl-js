import {Transform} from '../transform.ts';
import {MercatorTransform} from './mercator_transform.ts';
import {VerticalPerspectiveTransform} from './vertical_perspective_transform.ts';

import type {LngLat, LngLatLike} from '../lng_lat.ts';
import type Point from '@mapbox/point-geometry';
import type {Terrain} from '../../render/terrain.ts';
import type {ProjectedCamera} from '../../camera/projected_camera.ts';
import type {CameraProjectionKind} from '../../camera/camera_context.ts';
import type {IProjectionTransform, TransformOptions} from '../transform.ts';
import type {CameraOptionsFromTo, TransformConstrainFunction} from '../../camera/camera_types.ts';

/**
 * @internal
 * The part of a globe transform, which moves between the vertical perspective and mercator projections.
 * Both child parts belong to the same {@link Transform}, and this part answers with the one the globe renders with.
 */
export class GlobeTransform implements IProjectionTransform {

    /**
     * True when globe render path should be used instead of the old but simpler mercator rendering.
     * Globe automatically transitions to mercator at high zoom levels, which causes a switch from
     * globe to mercator render path.
     */
    readonly cameraProjection: CameraProjectionKind = 'globe';

    get projectionTransition(): number {
        return this._globeness;
    }

    get isGlobeRendering(): boolean {
        return this._globeness > 0;
    }

    setTransitionState(globeness: number): void {
        this._globeness = globeness;
    }

    private get currentTransform(): IProjectionTransform {
        return this.isGlobeRendering ? this._verticalPerspectiveTransform : this._mercatorTransform;
    }

    /**
     * Globe projection can smoothly interpolate between globe view and mercator. This variable controls this interpolation.
     * Value 0 is mercator, value 1 is globe, anything between is an interpolation between the two projections.
     */
    private _globeness: number = 1.0;
    private _mercatorTransform: MercatorTransform;
    private _verticalPerspectiveTransform: VerticalPerspectiveTransform;

    /**
     * @param getProjectedCamera - Returns the transform's camera as it is now, which both child parts read.
     */
    public constructor(getProjectedCamera: () => ProjectedCamera) {
        this._globeness = 1; // When transform is cloned for use in symbols, `_updateAnimation` function which usually sets this value never gets called.
        this._mercatorTransform = new MercatorTransform(getProjectedCamera);
        this._verticalPerspectiveTransform = new VerticalPerspectiveTransform(getProjectedCamera);
    }

    clone(getProjectedCamera: () => ProjectedCamera): GlobeTransform {
        const clone = new GlobeTransform(getProjectedCamera);
        clone._globeness = this._globeness;
        return clone;
    }

    getGroundElevationAtCenter(terrain?: Terrain): number | null {
        return this.currentTransform.getGroundElevationAtCenter(terrain);
    }

    /** Solved by the child that renders the current frame. */
    calculateCameraOptionsFromTo(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo: number): CameraOptionsFromTo {
        return this.currentTransform.calculateCameraOptionsFromTo(from, altitudeFrom, to, altitudeTo);
    }

    getCameraForLocationAtPoint(lnglat: LngLat, point: Point, elevation: number | undefined, constrain: TransformConstrainFunction): {center: LngLat; zoom: number} | null {
        return this.currentTransform.getCameraForLocationAtPoint(lnglat, point, elevation, constrain);
    }
}

/**
 * Creates a transform for the globe projection.
 */
export function createGlobeTransform(options?: TransformOptions): Transform {
    return new Transform((getProjectedCamera) => new GlobeTransform(getProjectedCamera), options);
}
