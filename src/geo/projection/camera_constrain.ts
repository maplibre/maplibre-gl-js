import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {mercatorXfromLng, mercatorYfromLat} from '../mercator_coordinate.ts';
import {clamp, degreesToRadians, MAX_VALID_LATITUDE, radiansToDegrees, remapSaturate, scaleZoom, wrap, zoomScale} from '../../util/util.ts';
import {lngLatBoxToWorldBox, projectToWorldCoordinates, unprojectFromWorldCoordinates} from './mercator_utils.ts';
import {getGlobeRadiusPixels, getZoomAdjustment} from './globe_utils.ts';
import {renderedProjection} from './camera_projection.ts';

import type {CameraState} from '../camera_state.ts';
import type {TransformConstrainFunction, WorldCoordinateHelper} from '../camera_types.ts';
import type {CameraProjection} from './camera_projection.ts';

/**
 * How many times larger than the viewport the area past the mercator edge has grown when the center is back on that edge.
 * While the area fits in the viewport the center can be on the pole.
 */
const POLE_AREA_FADE_SCALE = 4;

/**
 * @internal
 * What a camera is constrained with: its projection, and the function the map was given to use instead of the
 * projection's own constrain, or null.
 */
export type CameraContext = {
    readonly projection: CameraProjection;
    readonly constrainOverride: TransformConstrainFunction | null;
};

/**
 * @internal
 * Where the camera's constrain puts a center and a zoom: the override the map was given, or the projection's own,
 * see {@link defaultConstrain}.
 */
export function applyConstrain(state: CameraState, context: CameraContext, lngLat: LngLat, zoom: number): {center: LngLat; zoom: number} {
    return context.constrainOverride !== null ?
        context.constrainOverride(lngLat, zoom) :
        defaultConstrain(state, context.projection, lngLat, zoom);
}

/**
 * @internal
 * Where the projection's own constrain puts a center and a zoom, for a camera with the given size, padding and limits.
 * A globe constrains like the projection it draws with.
 */
export function defaultConstrain(state: CameraState, projection: CameraProjection, lngLat: LngLat, zoom: number): {center: LngLat; zoom: number} {
    const rendered = renderedProjection(projection);
    return rendered.kind === 'mercator' ?
        mercatorConstrain(state, rendered.worldCoordinateHelper, lngLat, zoom) :
        verticalPerspectiveConstrain(state, lngLat, zoom);
}

/**
 * The mercator constrain, which returns the center and the zoom so that everything beyond the bounds is excluded,
 * and the given location is as near the center as possible. The bounds are those set by maxBounds, or the north and
 * south poles and, if only one copy of the world is drawn, the antimeridian. A world that does not wrap (a registered
 * planar CRS) keeps its center inside its world square instead, see {@link constrainToWorldSquare}.
 */
function mercatorConstrain(state: CameraState, worldCoordinateHelper: WorldCoordinateHelper, lngLat: LngLat, zoom: number): {center: LngLat; zoom: number} {
    zoom = clamp(+zoom, state.minZoom, state.maxZoom);
    if (!worldCoordinateHelper.wraps) return constrainToWorldSquare(state, worldCoordinateHelper, lngLat, zoom);
    const result = {
        center: new LngLat(lngLat.lng, lngLat.lat),
        zoom
    };

    let lngRange = state.lngRange;

    if (!state.renderWorldCopies && lngRange === null) {
        const almost180 = 180 - 1e-10;
        lngRange = [-almost180, almost180];
    }

    const worldSize = state.tileSize * zoomScale(result.zoom); // A world size for the requested zoom level, not the current world size
    let minY = 0;
    let maxY = worldSize;
    let minX = 0;
    let maxX = worldSize;
    let scaleY = 0;
    let scaleX = 0;
    const {top, bottom, left, right} = state.padding;
    const screenWidth = state.width - left - right;
    const screenHeight = state.height - top - bottom;

    if (state.latRange) {
        const latRange = state.latRange;
        minY = mercatorYfromLat(latRange[1]) * worldSize;
        maxY = mercatorYfromLat(latRange[0]) * worldSize;
        const shouldZoomIn = maxY - minY < screenHeight;
        if (shouldZoomIn) scaleY = screenHeight / (maxY - minY);
    }

    if (lngRange) {
        minX = wrap(
            mercatorXfromLng(lngRange[0]) * worldSize,
            0,
            worldSize
        );
        maxX = wrap(
            mercatorXfromLng(lngRange[1]) * worldSize,
            0,
            worldSize
        );

        if (maxX < minX) maxX += worldSize;

        const shouldZoomIn = maxX - minX < screenWidth;
        if (shouldZoomIn) scaleX = screenWidth / (maxX - minX);
    }

    const {x: originalX, y: originalY} = projectToWorldCoordinates(worldSize, lngLat, worldCoordinateHelper);
    let modifiedX, modifiedY;

    const scale = Math.max(scaleX || 0, scaleY || 0);

    if (scale) {
        // zoom in to exclude all beyond the given lng/lat ranges
        const newPoint = new Point(
            scaleX ? (maxX + minX) / 2 : originalX,
            scaleY ? (maxY + minY) / 2 : originalY);
        result.center = unprojectFromWorldCoordinates(worldSize, newPoint, worldCoordinateHelper).wrap();
        result.zoom += scaleZoom(scale);
        return result;
    }

    if (state.latRange) {
        const h2 = screenHeight / 2;
        if (originalY - h2 < minY) modifiedY = minY + h2;
        if (originalY + h2 > maxY) modifiedY = maxY - h2;
    }

    if (lngRange) {
        const centerX = (minX + maxX) / 2;
        let wrappedX = originalX;
        if (state.renderWorldCopies) {
            wrappedX = wrap(originalX, centerX - worldSize / 2, centerX + worldSize / 2);
        }
        const w2 = screenWidth / 2;

        if (wrappedX - w2 < minX) modifiedX = minX + w2;
        if (wrappedX + w2 > maxX) modifiedX = maxX - w2;
    }

    // pan the map if the screen goes off the range
    if (modifiedX !== undefined || modifiedY !== undefined) {
        const newPoint = new Point(modifiedX ?? originalX, modifiedY ?? originalY);
        result.center = unprojectFromWorldCoordinates(worldSize, newPoint, worldCoordinateHelper).wrap();
    }

    return result;
}

/**
 * The constrain for a projection whose world does not wrap. Without max bounds only the center stays inside the
 * 0..1 world square and the zoom is left to `minZoom`: the square is the grid the tile matrix set picked, which
 * can be much larger than the area of interest or narrower than the window. With max bounds, projected as a box
 * since both world axes may depend on lng and lat, the view may not leave them and the map zooms in until they
 * fill the screen.
 */
function constrainToWorldSquare(state: CameraState, worldCoordinateHelper: WorldCoordinateHelper, lngLat: LngLat, zoom: number): {center: LngLat; zoom: number} {
    const lngRange = state.lngRange;
    const worldSize = state.tileSize * zoomScale(zoom);
    if (!lngRange) {
        const {x, y} = projectToWorldCoordinates(worldSize, lngLat, worldCoordinateHelper);
        const clampedX = clamp(x, 0, worldSize);
        const clampedY = clamp(y, 0, worldSize);
        if (clampedX !== x || clampedY !== y) {
            return {center: unprojectFromWorldCoordinates(worldSize, new Point(clampedX, clampedY), worldCoordinateHelper), zoom};
        }
        return {center: new LngLat(lngLat.lng, lngLat.lat), zoom};
    }
    const box = projectMaxBounds(worldCoordinateHelper, lngRange, state.latRange);
    const minX = Math.max(box.minX, 0) * worldSize;
    const maxX = Math.min(box.maxX, 1) * worldSize;
    const minY = Math.max(box.minY, 0) * worldSize;
    const maxY = Math.min(box.maxY, 1) * worldSize;
    const {width: screenWidth, height: screenHeight} = state;
    const scaleX = maxX - minX < screenWidth ? screenWidth / (maxX - minX) : 0;
    const scaleY = maxY - minY < screenHeight ? screenHeight / (maxY - minY) : 0;
    const {x, y} = projectToWorldCoordinates(worldSize, lngLat, worldCoordinateHelper);

    const scale = Math.max(scaleX, scaleY);
    if (scale) {
        const newPoint = new Point(scaleX ? (maxX + minX) / 2 : x, scaleY ? (maxY + minY) / 2 : y);
        return {center: unprojectFromWorldCoordinates(worldSize, newPoint, worldCoordinateHelper), zoom: zoom + scaleZoom(scale)};
    }

    const constrainedX = clamp(x, minX + screenWidth / 2, maxX - screenWidth / 2);
    const constrainedY = clamp(y, minY + screenHeight / 2, maxY - screenHeight / 2);
    if (constrainedX !== x || constrainedY !== y) {
        return {center: unprojectFromWorldCoordinates(worldSize, new Point(constrainedX, constrainedY), worldCoordinateHelper), zoom};
    }
    return {center: new LngLat(lngLat.lng, lngLat.lat), zoom};
}

/**
 * `maxBounds` projected into the world square, by the range arrays of the camera state it was projected for, which
 * are never written to. Projecting a box samples it on a grid and every constrain reads it.
 */
const maxBoundsWorldBoxes = new WeakMap<[number, number], {latRange: [number, number]; worldCoordinateHelper: WorldCoordinateHelper; box: {minX: number; minY: number; maxX: number; maxY: number}}>();

function projectMaxBounds(worldCoordinateHelper: WorldCoordinateHelper, lngRange: [number, number], latRange: [number, number]): {minX: number; minY: number; maxX: number; maxY: number} {
    const cached = maxBoundsWorldBoxes.get(lngRange);
    if (cached?.latRange === latRange && cached.worldCoordinateHelper === worldCoordinateHelper) return cached.box;
    const box = lngLatBoxToWorldBox(worldCoordinateHelper, lngRange[0], latRange[0], lngRange[1], latRange[1]);
    maxBoundsWorldBoxes.set(lngRange, {latRange, worldCoordinateHelper, box});
    return box;
}

/**
 * The vertical perspective constrain, which keeps the zoom within its limits, adjusted for the planet's scale at the
 * latitude, and the center as close to a pole as {@link getMaxLatitude} allows. It does not respect the max bounds.
 */
function verticalPerspectiveConstrain(state: CameraState, lngLat: LngLat, zoom: number): {center: LngLat; zoom: number} {
    const constrainedZoom = clamp(+zoom, state.minZoom + getZoomAdjustment(0, lngLat.lat), state.maxZoom);
    const maxLatitude = getMaxLatitude(state, constrainedZoom);
    return {
        center: new LngLat(
            lngLat.lng,
            clamp(lngLat.lat, -maxLatitude, maxLatitude)
        ),
        zoom: constrainedZoom
    };
}

/**
 * Returns how close to a pole the center can be at the given zoom. Past the mercator edge there is no data,
 * so the center reaches the pole only while that area fits in the viewport, and eases back to the edge as it outgrows it.
 */
function getMaxLatitude(state: CameraState, zoom: number): number {
    const areaRadians = degreesToRadians(90 - MAX_VALID_LATITUDE);
    const areaPixels = getGlobeRadiusPixels(state.tileSize * zoomScale(zoom), MAX_VALID_LATITUDE) * areaRadians;
    const reachPixels = Math.min(state.width, state.height) / 2;
    const centerPixels = Math.min(areaPixels, reachPixels) * remapSaturate(areaPixels, reachPixels, reachPixels * POLE_AREA_FADE_SCALE, 1, 0);
    return MAX_VALID_LATITUDE + radiansToDegrees(areaRadians * centerPixels / areaPixels);
}
