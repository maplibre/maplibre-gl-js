import Point from '@mapbox/point-geometry';
import {LngLat} from '../geo/lng_lat';
import {clamp, lerp, remapSaturate} from '../util/util';
import {getGlobeCircumferencePixels, getZoomAdjustment} from '../geo/projection/globe_transform';
import {MAX_VALID_LATITUDE} from '../geo/transform';

export function getDegreesPerPixel(worldSize: number, lat: number): number {
    return 360.0 / getGlobeCircumferencePixels({worldSize, center: {lat}});
}

export function computeGlobePanCenter(panDelta: Point, tr: {
    readonly angle: number;
    readonly worldSize: number;
    readonly center: LngLat;
    readonly zoom: number;
    scaleZoom(scale: number): number;
}): LngLat {
    // Apply map bearing to the panning vector
    const rotatedPanDelta = panDelta.rotate(-tr.angle);
    // Note: we divide longitude speed by planet width at the given latitude. But we diminish this effect when the globe is zoomed out a lot.
    const normalizedGlobeZoom = tr.zoom + getZoomAdjustment(tr, tr.center.lat, 0); // If the transform center would be moved to latitude 0, what would the current zoom be?
    const lngSpeed = lerp(
        1.0 / Math.cos(tr.center.lat * Math.PI / 180), // speed adjusted by latitude
        1.0 / Math.cos(Math.min(Math.abs(tr.center.lat), 60) * Math.PI / 180), // also adjusted, but latitude is clamped to 60° to avoid too large speeds near poles
        remapSaturate(normalizedGlobeZoom, 7, 3, 0, 1.0) // Empirically chosen values
    );
    const panningDegreesPerPixel = getDegreesPerPixel(tr.worldSize, tr.center.lat);
    return new LngLat(
        tr.center.lng - rotatedPanDelta.x * panningDegreesPerPixel * lngSpeed,
        clamp(tr.center.lat + rotatedPanDelta.y * panningDegreesPerPixel, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE)
    );
}
