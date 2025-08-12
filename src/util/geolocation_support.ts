import {LngLat, earthRadius as WGS84_EARTH_RADIUS} from '../geo/lng_lat';
import type Point from '@mapbox/point-geometry';

export default {checkGeolocationSupport, destination, computeCirclePixelDiameter};

let supportsGeolocation;
export async function checkGeolocationSupport(forceRecalculation = false): Promise<boolean> {
    if (supportsGeolocation !== undefined && !forceRecalculation) {
        return supportsGeolocation;
    }
    if (window.navigator.permissions === undefined) {
        supportsGeolocation = !!window.navigator.geolocation;
        return supportsGeolocation;
    }
    // navigator.permissions has incomplete browser support
    // https://caniuse.com/#feat=permissions-api
    // Test for the case where a browser disables Geolocation because of an
    // insecure origin
    try {
        const permissions = await window.navigator.permissions.query({name: 'geolocation'});
        supportsGeolocation = permissions.state !== 'denied';
    } catch {
        // Fix for iOS16 which rejects query but still supports geolocation
        supportsGeolocation = !!window.navigator.geolocation;
    }
    return supportsGeolocation;
};

export type Projector = {
    project(ll: LngLat): Point;
};

/**
 * Geodesic destination from origin by bearing (degrees) and distance (meters).
 * Longitudes are wrapped into (-180, 180].
 */
export function destination(origin: LngLat, bearingDeg: number, distanceMeters: number, earthRadius = WGS84_EARTH_RADIUS): LngLat {
    if (!isFinite(origin.lat) || !isFinite(origin.lng)) throw new Error('Invalid origin');
    if (!isFinite(bearingDeg) || !isFinite(distanceMeters)) throw new Error('Invalid input');
    if (distanceMeters < 0) distanceMeters = 0;

    const latRadians = origin.lat * Math.PI / 180;
    const lngRadians = origin.lng * Math.PI / 180;
    // Normalize bearing to [0, 360)
    const bearingRadians = ((bearingDeg % 360) + 360) % 360 * Math.PI / 180;
    const distanceToEarth = distanceMeters / earthRadius;

    const sinLatitude = Math.sin(latRadians);
    const cosLatitude = Math.cos(latRadians);
    const sinDistanceToEarth = Math.sin(distanceToEarth);
    const cosDistanceToEarth = Math.cos(distanceToEarth);

    const sinLatitudePlusEarthProduct = sinLatitude + cosLatitude * sinDistanceToEarth * Math.cos(bearingRadians);
    // Numerically stable: clamp to [-1, 1] for asin
    const asinLatitudePlusEarthProduct = Math.asin(Math.max(-1, Math.min(1, sinLatitudePlusEarthProduct)));

    // Use atan2 formulation
    const y = Math.sin(bearingRadians) * sinDistanceToEarth * cosLatitude;
    const x = cosDistanceToEarth - sinLatitude * Math.sin(asinLatitudePlusEarthProduct);
    const lngTanPlusRadians = lngRadians + Math.atan2(y, x);

    // Normalize longitude to (-180, 180]
    let longitude = lngTanPlusRadians * 180 / Math.PI;
    if (longitude > 180) longitude = ((longitude + 180) % 360) - 180;
    if (longitude <= -180) longitude = ((longitude - 180) % 360) + 180;
    const latitude = Math.max(-90, Math.min(90, asinLatitudePlusEarthProduct * 180 / Math.PI));

    return new LngLat(longitude, latitude);
}

/**
 * Compute circle pixel diameter under current view by sampling the circle’s geodesic
 * boundary and projecting to screen. Accounts for pitch, bearing, and camera distance.
 *
 * Options:
 * - samples: number of samples around the circle (default 16)
 * - seedAngleDeg: starting angle for sampling (e.g., current map bearing) to reduce flicker
 */
export function computeCirclePixelDiameter(
    projector: Projector,
    centerLL: LngLat,
    radiusMeters: number,
    options?: { samples?: number; seedAngleDeg?: number }
): number {
    if (!isFinite(radiusMeters) || radiusMeters <= 0) return 0;

    const samples = Math.max(8, Math.floor(options?.samples ?? 16));
    const seed = options?.seedAngleDeg ?? 0;

    const centerPx = projector.project(centerLL);
    let maxRadiusPx = 0;

    for (let i = 0; i < samples; i++) {
        const bearingDeg = seed + (i * 360) / samples;
        const ptLL = destination(centerLL, bearingDeg, radiusMeters);
        const ptPx = projector.project(ptLL);
        const rPx = Math.hypot(ptPx.x - centerPx.x, ptPx.y - centerPx.y);
        if (rPx > maxRadiusPx) maxRadiusPx = rPx;
    }

    return Math.max(0, 2 * maxRadiusPx);
};
