import Point from '@mapbox/point-geometry';
import {IReadonlyTransform, ITransform} from '../transform_interface';
import {ICameraHelper, MapControlsDeltas} from './camera_helper';
import {GlobeProjection} from './globe';
import {LngLat} from '../lng_lat';
import {MercatorCameraHelper} from './mercator_camera_helper';
import {computeGlobePanCenter, getGlobeRadiusPixels, getZoomAdjustment} from './globe_utils';
import {clamp, createVec3f64, differenceOfAnglesDegrees, remapSaturate} from '../../util/util';
import {vec3} from 'gl-matrix';
import {MAX_VALID_LATITUDE, zoomScale} from '../transform_helper';

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
}
