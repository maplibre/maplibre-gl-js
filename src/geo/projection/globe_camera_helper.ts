import Point from '@mapbox/point-geometry';
import {IReadonlyTransform, ITransform} from '../transform_interface';
import {cameraBoundsWarning, ICameraHelper, MapControlsDeltas} from './camera_helper';
import {GlobeProjection} from './globe';
import {LngLat, LngLatLike} from '../lng_lat';
import {MercatorCameraHelper} from './mercator_camera_helper';
import {angularCoordinatesToSurfaceVector, computeGlobePanCenter, getGlobeRadiusPixels, getZoomAdjustment} from './globe_utils';
import {clamp, createVec3f64, differenceOfAnglesDegrees, remapSaturate} from '../../util/util';
import {mat4, vec3} from 'gl-matrix';
import {MAX_VALID_LATITUDE, scaleZoom, zoomScale} from '../transform_helper';
import {CameraForBoundsOptions} from '../../ui/camera';
import {LngLatBounds} from '../lng_lat_bounds';
import {PaddingOptions} from '../edge_insets';

/**
 * @internal
 */
export class GlobeCameraHelper implements ICameraHelper {
    private _globe: GlobeProjection;
    private _mercatorCameraHelper: MercatorCameraHelper;

    constructor(globe: GlobeProjection) {
        this._globe = globe;
        this._mercatorCameraHelper = new MercatorCameraHelper();
    }

    get useGlobeControls(): boolean { return this._globe.useGlobeRendering; }

    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    } {
        if (!this.useGlobeControls) {
            return this._mercatorCameraHelper.handlePanInertia(pan, transform);
        }

        const panCenter = computeGlobePanCenter(pan, transform);
        if (Math.abs(panCenter.lng - transform.center.lng) > 180) {
            // If easeTo target would be over 180° distant, the animation would move
            // in the opposite direction that what the user intended.
            // Thus we clamp the movement to 179.5°.
            panCenter.lng = transform.center.lng + 179.5 * Math.sign(panCenter.lng - transform.center.lng);
        }
        return {
            easingCenter: panCenter,
            easingOffset: new Point(0, 0),
        };
    }

    handleMapControlsPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void {
        if (!this.useGlobeControls) {
            this._mercatorCameraHelper.handleMapControlsPitchBearingZoom(deltas, tr);
            return;
        }

        const zoomPixel = deltas.around;
        const zoomLoc = tr.screenPointToLocation(zoomPixel);

        if (deltas.bearingDelta) tr.setBearing(tr.bearing + deltas.bearingDelta);
        if (deltas.pitchDelta) tr.setPitch(tr.pitch + deltas.pitchDelta);
        const oldZoomPreZoomDelta = tr.zoom;
        if (deltas.zoomDelta) tr.setZoom(tr.zoom + deltas.zoomDelta);
        const actualZoomDelta = tr.zoom - oldZoomPreZoomDelta;

        if (actualZoomDelta === 0) {
            return;
        }

        // Problem: `setLocationAtPoint` for globe works when it is called a single time, but is a little glitchy in practice when used repeatedly for zooming.
        // - `setLocationAtPoint` repeatedly called at a location behind a pole will eventually glitch out
        // - `setLocationAtPoint` at location the longitude of which is more than 90° different from current center will eventually glitch out
        // But otherwise works fine at higher zooms, or when the target is somewhat near the current map center.
        // Solution: use a heuristic zooming in the problematic cases and interpolate to `setLocationAtPoint` when possible.

        // Magic numbers that control:
        // - when zoom movement slowing starts for cursor not on globe (avoid unnatural map movements)
        // - when we interpolate from exact zooming to heuristic zooming based on longitude difference of target location to current center
        // - when we interpolate from exact zooming to heuristic zooming based on globe being too small on screen
        // - when zoom movement slowing starts for globe being too small on viewport (avoids unnatural/unwanted map movements when map is zoomed out a lot)
        const raySurfaceDistanceForSlowingStart = 0.3; // Zoom movement slowing will start when the planet surface to ray distance is greater than this number (globe radius is 1, so 0.3 is ~2000km form the surface).
        const slowingMultiplier = 0.5; // The lower this value, the slower will the "zoom movement slowing" occur.
        const interpolateToHeuristicStartLng = 45; // When zoom location longitude is this many degrees away from map center, we start interpolating from exact zooming to heuristic zooming.
        const interpolateToHeuristicEndLng = 85; // Longitude difference at which interpolation to heuristic zooming ends.
        const interpolateToHeuristicExponent = 0.25; // Makes interpolation smoother.
        const interpolateToHeuristicStartRadius = 0.75; // When globe is this many times larger than the smaller viewport dimension, we start interpolating from exact zooming to heuristic zooming.
        const interpolateToHeuristicEndRadius = 0.35; // Globe size at which interpolation to heuristic zooming ends.
        const slowingRadiusStart = 0.9; // If globe is this many times larger than the smaller viewport dimension, start inhibiting map movement while zooming
        const slowingRadiusStop = 0.5;
        const slowingRadiusSlowFactor = 0.25; // How much is movement slowed when globe is too small

        const dLngRaw = differenceOfAnglesDegrees(tr.center.lng, zoomLoc.lng);
        const dLng = dLngRaw / (Math.abs(dLngRaw / 180) + 1.0); // This gradually reduces the amount of longitude change if the zoom location is very far, eg. on the other side of the pole (possible when looking at a pole).
        const dLat = differenceOfAnglesDegrees(tr.center.lat, zoomLoc.lat);

        // Slow zoom movement down if the mouse ray is far from the planet.
        const rayDirection = tr.getRayDirectionFromPixel(zoomPixel);
        const rayOrigin = tr.cameraPosition;
        const distanceToClosestPoint = vec3.dot(rayOrigin, rayDirection) * -1; // Globe center relative to ray origin is equal to -rayOrigin and rayDirection is normalized, thus we want to compute dot(-rayOrigin, rayDirection).
        const closestPoint = createVec3f64();
        vec3.add(closestPoint, rayOrigin, [
            rayDirection[0] * distanceToClosestPoint,
            rayDirection[1] * distanceToClosestPoint,
            rayDirection[2] * distanceToClosestPoint
        ]);
        const distanceFromSurface = vec3.length(closestPoint) - 1;
        const distanceFactor = Math.exp(-Math.max(distanceFromSurface - raySurfaceDistanceForSlowingStart, 0) * slowingMultiplier);

        // Slow zoom movement down if the globe is too small on viewport
        const radius = getGlobeRadiusPixels(tr.worldSize, tr.center.lat) / Math.min(tr.width, tr.height); // Radius relative to larger viewport dimension
        const radiusFactor = remapSaturate(radius, slowingRadiusStart, slowingRadiusStop, 1.0, slowingRadiusSlowFactor);

        // Compute how much to move towards the zoom location
        const factor = (1.0 - zoomScale(-actualZoomDelta)) * Math.min(distanceFactor, radiusFactor);

        const oldCenterLat = tr.center.lat;
        const oldZoom = tr.zoom;
        const heuristicCenter = new LngLat(
            tr.center.lng + dLng * factor,
            clamp(tr.center.lat + dLat * factor, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE)
        );

        // Now compute the map center exact zoom
        tr.setLocationAtPoint(zoomLoc, zoomPixel);
        const exactCenter = tr.center;

        // Interpolate between exact zooming and heuristic zooming depending on the longitude difference between current center and zoom location.
        const interpolationFactorLongitude = remapSaturate(Math.abs(dLngRaw), interpolateToHeuristicStartLng, interpolateToHeuristicEndLng, 0, 1);
        const interpolationFactorRadius = remapSaturate(radius, interpolateToHeuristicStartRadius, interpolateToHeuristicEndRadius, 0, 1);
        const heuristicFactor = Math.pow(Math.max(interpolationFactorLongitude, interpolationFactorRadius), interpolateToHeuristicExponent);

        const lngExactToHeuristic = differenceOfAnglesDegrees(exactCenter.lng, heuristicCenter.lng);
        const latExactToHeuristic = differenceOfAnglesDegrees(exactCenter.lat, heuristicCenter.lat);

        tr.setCenter(new LngLat(
            exactCenter.lng + lngExactToHeuristic * heuristicFactor,
            exactCenter.lat + latExactToHeuristic * heuristicFactor
        ).wrap());
        tr.setZoom(oldZoom + getZoomAdjustment(oldCenterLat, tr.center.lat));
    }

    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat): void {
        if (!this.useGlobeControls) {
            this._mercatorCameraHelper.handleMapControlsPan(deltas, tr, preZoomAroundLoc);
            return;
        }

        if (!deltas.panDelta) {
            return;
        }

        // These are actually very similar to mercator controls, and should converge to them at high zooms.
        // We avoid using the "grab a place and move it around" approach from mercator here,
        // since it is not a very pleasant way to pan a globe.
        const oldLat = tr.center.lat;
        const oldZoom = tr.zoom;
        tr.setCenter(computeGlobePanCenter(deltas.panDelta, tr).wrap());
        // Setting the center might adjust zoom to keep globe size constant, we need to avoid adding this adjustment a second time
        tr.setZoom(oldZoom + getZoomAdjustment(oldLat, tr.center.lat));
    }

    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: ITransform) {
        const result = this._mercatorCameraHelper.cameraForBoxAndBearing(options, padding, bounds, bearing, tr);

        if (!this.useGlobeControls) {
            return result;
        }

        // If globe is enabled, we use the parameters computed for mercator, and just update the zoom to fit the bounds.

        // Get clip space bounds including padding
        const xLeft = (padding.left) / tr.width * 2.0 - 1.0;
        const xRight = (tr.width - padding.right) / tr.width * 2.0 - 1.0;
        const yTop = (padding.top) / tr.height * -2.0 + 1.0;
        const yBottom = (tr.height - padding.bottom) / tr.height * -2.0 + 1.0;

        // Get camera bounds
        const flipEastWest = differenceOfAnglesDegrees(bounds.getWest(), bounds.getEast()) < 0;
        const lngWest = flipEastWest ? bounds.getEast() : bounds.getWest();
        const lngEast = flipEastWest ? bounds.getWest() : bounds.getEast();

        const latNorth = Math.max(bounds.getNorth(), bounds.getSouth()); // "getNorth" doesn't always return north...
        const latSouth = Math.min(bounds.getNorth(), bounds.getSouth());

        // Additional vectors will be tested for the rectangle midpoints
        const lngMid = lngWest + differenceOfAnglesDegrees(lngWest, lngEast) * 0.5;
        const latMid = latNorth + differenceOfAnglesDegrees(latNorth, latSouth) * 0.5;

        // Obtain a globe projection matrix that does not include pitch (unsupported)
        const clonedTr = tr.clone();
        clonedTr.setCenter(result.center);
        clonedTr.setBearing(result.bearing);
        clonedTr.setPitch(0);
        clonedTr.setZoom(result.zoom);
        const matrix = clonedTr.modelViewProjectionMatrix;

        // Vectors to test - the bounds' corners and edge midpoints
        const testVectors = [
            angularCoordinatesToSurfaceVector(bounds.getNorthWest()),
            angularCoordinatesToSurfaceVector(bounds.getNorthEast()),
            angularCoordinatesToSurfaceVector(bounds.getSouthWest()),
            angularCoordinatesToSurfaceVector(bounds.getSouthEast()),
            // Also test edge midpoints
            angularCoordinatesToSurfaceVector(new LngLat(lngEast, latMid)),
            angularCoordinatesToSurfaceVector(new LngLat(lngWest, latMid)),
            angularCoordinatesToSurfaceVector(new LngLat(lngMid, latNorth)),
            angularCoordinatesToSurfaceVector(new LngLat(lngMid, latSouth))
        ];
        const vecToCenter = angularCoordinatesToSurfaceVector(result.center);

        // Test each vector, measure how much to scale down the globe to satisfy all tested points that they are inside clip space.
        let smallestNeededScale = Number.POSITIVE_INFINITY;
        for (const vec of testVectors) {
            if (xLeft < 0)
                smallestNeededScale = GlobeCameraHelper.getLesserNonNegativeNonNull(smallestNeededScale, GlobeCameraHelper.solveVectorScale(vec, vecToCenter, matrix, 'x', xLeft));
            if (xRight > 0)
                smallestNeededScale = GlobeCameraHelper.getLesserNonNegativeNonNull(smallestNeededScale, GlobeCameraHelper.solveVectorScale(vec, vecToCenter, matrix, 'x', xRight));
            if (yTop > 0)
                smallestNeededScale = GlobeCameraHelper.getLesserNonNegativeNonNull(smallestNeededScale, GlobeCameraHelper.solveVectorScale(vec, vecToCenter, matrix, 'y', yTop));
            if (yBottom < 0)
                smallestNeededScale = GlobeCameraHelper.getLesserNonNegativeNonNull(smallestNeededScale, GlobeCameraHelper.solveVectorScale(vec, vecToCenter, matrix, 'y', yBottom));
        }

        if (!Number.isFinite(smallestNeededScale) || smallestNeededScale === 0) {
            cameraBoundsWarning();
            return undefined;
        }

        // Compute target zoom from the obtained scale.
        result.zoom = clonedTr.zoom + scaleZoom(smallestNeededScale);
    }

    /**
     * Handles the zoom and center change during camera jumpTo.
     */
    handleJumpToCenterZoom(tr: ITransform, options: { zoom?: number; apparentZoom?: number; center?: LngLatLike }): void {
        if (!this.useGlobeControls) {
            this._mercatorCameraHelper.handleJumpToCenterZoom(tr, options);
            return;
        }

        const optionsZoom = typeof options.zoom === 'number';
        const optionsApparentZoom = typeof options.apparentZoom === 'number';

        // Special zoom & center handling for globe:
        // Globe constrained center isn't dependent on zoom level
        const startingLat = tr.center.lat;
        const constrainedCenter = tr.getConstrained(options.center ? LngLat.convert(options.center) : tr.center, tr.zoom).center;
        tr.setCenter(constrainedCenter.wrap());

        // Make sure to correctly apply apparentZoom
        let targetZoom;
        if (optionsApparentZoom) {
            targetZoom = +options.apparentZoom + getZoomAdjustment(startingLat, constrainedCenter.lat);
        } else if (optionsZoom) {
            targetZoom = +options.zoom;
        } else {
            targetZoom = tr.zoom + getZoomAdjustment(startingLat, constrainedCenter.lat);
        }
        if (tr.zoom !== targetZoom) {
            tr.setZoom(targetZoom);
        }
    }

    /**
     * Computes how much to scale the globe in order for a given point on its surface (a location) to project to a given clip space coordinate in either the X or the Y axis.
     * @param vector - Position of the queried location on the surface of the unit sphere globe.
     * @param toCenter - Position of current transform center on the surface of the unit sphere globe.
     * This is needed because zooming the globe not only changes its scale,
     * but also moves the camera closer or further away along this vector (pitch is disregarded).
     * @param projection - The globe projection matrix.
     * @param targetDimension - The dimension in which the scaled vector must match the target value in clip space.
     * @param targetValue - The target clip space value in the specified dimension to which the queried vector must project.
     * @returns How much to scale the globe.
     */
    private static solveVectorScale(vector: vec3, toCenter: vec3, projection: mat4, targetDimension: 'x' | 'y', targetValue: number): number | null {
        // We want to compute how much to scale the sphere in order for the input `vector` to project to `targetValue` in the given `targetDimension` (X or Y).
        const k = targetValue;
        const columnXorY = targetDimension === 'x' ?
            [projection[0], projection[4], projection[8], projection[12]] : // X
            [projection[1], projection[5], projection[9], projection[13]];  // Y
        const columnZ = [projection[3], projection[7], projection[11], projection[15]];

        const vecDotXY = vector[0] * columnXorY[0] + vector[1] * columnXorY[1] + vector[2] * columnXorY[2];
        const vecDotZ = vector[0] * columnZ[0] + vector[1] * columnZ[1] + vector[2] * columnZ[2];
        const toCenterDotXY = toCenter[0] * columnXorY[0] + toCenter[1] * columnXorY[1] + toCenter[2] * columnXorY[2];
        const toCenterDotZ = toCenter[0] * columnZ[0] + toCenter[1] * columnZ[1] + toCenter[2] * columnZ[2];

        // The following can be derived from writing down what happens to a vector scaled by a parameter ("V * t") when it is multiplied by a projection matrix, then solving for "t".
        // Or rather, we derive it for a vector "V * t + (1-t) * C". Where V is `vector` and C is `toCenter`. The extra addition is needed because zooming out also moves the camera along "C".

        const t = (toCenterDotXY + columnXorY[3] - k * toCenterDotZ - k * columnZ[3]) / (toCenterDotXY - vecDotXY - k * toCenterDotZ + k * vecDotZ);

        if (
            toCenterDotXY + k * vecDotZ === vecDotXY + k * toCenterDotZ ||
            columnZ[3] * (vecDotXY - toCenterDotXY) + columnXorY[3] * (toCenterDotZ - vecDotZ) + vecDotXY * toCenterDotZ === toCenterDotXY * vecDotZ
        ) {
            // The computed result is invalid.
            return null;
        }
        return t;
    }

    /**
     * Returns `newValue` if it is:
     *
     * - not null AND
     * - not negative AND
     * - smaller than `newValue`,
     *
     * ...otherwise returns `oldValue`.
     */
    private static getLesserNonNegativeNonNull(oldValue: number, newValue: number): number {
        if (newValue !== null && newValue >= 0 && newValue < oldValue) {
            return newValue;
        } else {
            return oldValue;
        }
    }
}
