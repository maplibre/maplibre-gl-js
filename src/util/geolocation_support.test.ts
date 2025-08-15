import {describe, beforeEach, test, expect, vi} from 'vitest';
import {checkGeolocationSupport} from './geolocation_support';

import Point from '@mapbox/point-geometry';
import {LngLat, earthRadius as WGS84} from '../../src/geo/lng_lat';
import {destination, computeCirclePixelDiameter, type Projector} from '../../src/util/geolocation_support';

describe('checkGeolocationSupport', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    test('it should return false if geolocation is not defined', async () => {
        await expect(checkGeolocationSupport()).resolves.toBeFalsy();
    });

    test('it should return the cached value on second call', async () => {
        const returnValue = await checkGeolocationSupport();
        expect(returnValue).toBeFalsy();
        (window.navigator as any).geolocation = {};
        const rv = await checkGeolocationSupport();
        expect(rv).toBe(returnValue);
    });

    test('it should return the true if geolocation is defined', async () => {
        (window.navigator as any).geolocation = {};
        const returnValue = await checkGeolocationSupport(true);
        expect(returnValue).toBeTruthy();
    });

    test('it should check permissions if possible', async () => {
        (window.navigator as any).geolocation = {};
        (window.navigator as any).permissions = {
            query: () => Promise.resolve({state: 'granted'})
        };
        const returnValue = await checkGeolocationSupport(true);
        expect(returnValue).toBeTruthy();
    });

    test('it should check permissions and geolocation for iOS 16 promise rejection', async () => {
        (window.navigator as any).geolocation = undefined;
        (window.navigator as any).permissions = {
            query: () => Promise.reject(new Error('perissions error'))
        };
        const returnValue = await checkGeolocationSupport(true);
        expect(returnValue).toBeFalsy();
    });
});

// Helper: local meters-per-degree at a given latitude
function metersPerDegLat(): number {
    return Math.PI / 180 * WGS84;
}
function metersPerDegLng(latDeg: number): number {
    return Math.PI / 180 * WGS84 * Math.cos(latDeg * Math.PI / 180);
}

describe('destination (geodesic)', () => {
    test('returns origin for zero distance', () => {
        const o = new LngLat(12.3, -45.6);
        const d = destination(o, 123, 0);
        expect(d.lng).toBeCloseTo(o.lng, 12);
        expect(d.lat).toBeCloseTo(o.lat, 12);
    });

    test('moves ~0.00899 deg latitude per km at equator (north)', () => {
        const o = new LngLat(0, 0);
        const d = destination(o, 0, 1000);
        expect(d.lat).toBeCloseTo(0.00899, 3);
        expect(d.lng).toBeCloseTo(0.0, 6);
    });

    test('bearing normalization: -90 and 270 give the same result', () => {
        const o = new LngLat(30, 10);
        const a = destination(o, -90, 500);
        const b = destination(o, 270, 500);
        expect(a.lng).toBeCloseTo(b.lng, 12);
        expect(a.lat).toBeCloseTo(b.lat, 12);
    });

    test('wraps longitudes across the antimeridian', () => {
        const o = new LngLat(179.9, 0);
        const d = destination(o, 90, 20000); // ~20 km east crosses 180
        expect(d.lng).toBeLessThanOrEqual(180);
        expect(d.lng).toBeGreaterThan(-180);
    });

    test('clamps latitude near poles', () => {
        const o = new LngLat(0, 89.999);
        const d = destination(o, 0, 50000);
        expect(d.lat).toBeLessThanOrEqual(90);
        expect(d.lat).toBeGreaterThanOrEqual(-90);
    });

    test('is continuous for small distances at various headings', () => {
        const o = new LngLat(-77.0365, 38.8977);
        const r = 10; // 10 m
        const bearings = [0, 45, 90, 135, 180, 225, 270, 315];
        for (const b of bearings) {
            const d = destination(o, b, r);
            const back = destination(d, (b + 180), r);
            // Small round-trip error due to spherical math vs local tangent assumption
            expect(back.lng).toBeCloseTo(o.lng, 6);
            expect(back.lat).toBeCloseTo(o.lat, 6);
        }
    });
});

describe('computeCirclePixelDiameter (projection-aware sampling)', () => {
    test('returns 0 for non-positive radius', () => {
        const center = new LngLat(0, 0);
        const projector = new TestProjector(center);
        expect(computeCirclePixelDiameter(projector, center, 0)).toBe(0);
        expect(computeCirclePixelDiameter(projector, center, -5)).toBe(0);
        expect(computeCirclePixelDiameter(projector, center, Number.NaN)).toBe(0);
    });

    test('matches 2 * radius * scale in an isotropic linear projector', () => {
        const center = new LngLat(0, 0);
        const sx = 2.5, sy = 2.5; // isotropic
        const projector = new TestProjector(center, {sx, sy});
        const radius = 1234; // meters
        const d = computeCirclePixelDiameter(projector, center, radius, {samples: 32});
        const expected = 2 * radius * sx; // == sy
        expect(d).toBeCloseTo(expected, 2);
    });

    test('uses the max singular value under anisotropic scaling (no rotation)', () => {
        const center = new LngLat(-3, 52);
        const sx = 1.5, sy = 0.5; // ellipse; major axis scale = 1.5
        const projector = new TestProjector(center, {sx, sy});
        const radius = 1000;
        const d = computeCirclePixelDiameter(projector, center, radius, {samples: 64});
        const expected = 2 * radius * Math.max(sx, sy);
        // Allow small sampling error
        expect(Math.abs(d - expected) / expected).toBeLessThan(0.02);
    });

    test('rotation does not change the diameter (only orientation)', () => {
        const center = new LngLat(10, 10);
        const sx = 3.0, sy = 1.0;
        const radius = 800;
        const p0 = new TestProjector(center, {sx, sy, rotationDeg: 0});
        const p45 = new TestProjector(center, {sx, sy, rotationDeg: 45});
        const p90 = new TestProjector(center, {sx, sy, rotationDeg: 90});

        const d0 = computeCirclePixelDiameter(p0, center, radius, {samples: 64});
        const d45 = computeCirclePixelDiameter(p45, center, radius, {samples: 64});
        const d90 = computeCirclePixelDiameter(p90, center, radius, {samples: 64});

        // All should be equal within small tolerance
        const ref = d0;
        expect(Math.abs(d45 - ref) / ref).toBeLessThan(0.02);
        expect(Math.abs(d90 - ref) / ref).toBeLessThan(0.02);
    });

    test('seedAngleDeg does not change the value, but allows consistent sampling lattice', () => {
        const center = new LngLat(-73.9857, 40.7484);
        const projector = new TestProjector(center, {sx: 2.0, sy: 1.0, rotationDeg: 33});
        const radius = 500;

        const dA = computeCirclePixelDiameter(projector, center, radius, {samples: 16, seedAngleDeg: 33});
        const dB = computeCirclePixelDiameter(projector, center, radius, {samples: 16, seedAngleDeg: 0});
        // Differences only from discrete sampling, should be tiny
        expect(Math.abs(dA - dB) / dA).toBeLessThan(0.02);
    });

    test('respects center latitude for meters-per-degree in projector (non-equatorial)', () => {
        // Different latitude => different m/deg for longitude => different projected diameter
        const centerLowLat = new LngLat(0, 10);
        const centerHighLat = new LngLat(0, 70);
        const pLow = new TestProjector(centerLowLat, {sx: 1.0, sy: 1.0});
        const pHigh = new TestProjector(centerHighLat, {sx: 1.0, sy: 1.0});
        const radius = 10000;

        const dLow = computeCirclePixelDiameter(pLow, centerLowLat, radius, {samples: 32});
        const dHigh = computeCirclePixelDiameter(pHigh, centerHighLat, radius, {samples: 32});

        // At higher latitudes, meters-per-degree longitude is smaller, but our projector accounts for it,
        // so the projected diameters remain comparable; no strict inequality expected,
        // just ensure computation is finite and stable.
        expect(Number.isFinite(dLow)).toBe(true);
        expect(Number.isFinite(dHigh)).toBe(true);
        expect(dLow).toBeGreaterThan(0);
        expect(dHigh).toBeGreaterThan(0);
    });

    test('handles near-antimeridian centers with small radii without discontinuity', () => {
        const center = new LngLat(179.99, 0);
        const projector = new TestProjector(center, {sx: 1.0, sy: 1.0});
        const radius = 500; // small -> should not cross antimeridian in geodesic destination

        const d = computeCirclePixelDiameter(projector, center, radius, {samples: 24});
        expect(Number.isFinite(d)).toBe(true);
        expect(d).toBeGreaterThan(0);
    });
});

// A deterministic projector mapping LngLat to a local tangent plane in meters, with optional
// anisotropic scaling and rotation to simulate perspective-like distortion.
// Projector is centered on `origin` and returns a Point in "pixels" (meters scaled by sx/sy and rotated).
class TestProjector implements Projector {
    private readonly lon0: number;
    private readonly lat0: number;
    private readonly mPerDegLat: number;
    private readonly mPerDegLng: number;
    private readonly cosR: number;
    private readonly sinR: number;
    private readonly sx: number;
    private readonly sy: number;

    constructor(origin: LngLat, opts?: { sx?: number; sy?: number; rotationDeg?: number }) {
        this.lon0 = origin.lng;
        this.lat0 = origin.lat;
        this.mPerDegLat = metersPerDegLat();
        this.mPerDegLng = metersPerDegLng(this.lat0);
        this.sx = opts?.sx ?? 1;
        this.sy = opts?.sy ?? 1;
        const r = (opts?.rotationDeg ?? 0) * Math.PI / 180;
        this.cosR = Math.cos(r);
        this.sinR = Math.sin(r);
    }

    project(ll: LngLat): Point {
        // Convert to local meters relative to origin using simple equirectangular at origin latitude
        let dLon = ll.lng - this.lon0;
        // Wrap delta lon into [-180, 180] to avoid antimeridian explosions
        if (dLon > 180) dLon = dLon - 360;
        if (dLon < -180) dLon = dLon + 360;

        const dLat = ll.lat - this.lat0;
        const xMeters = dLon * this.mPerDegLng;
        const yMeters = dLat * this.mPerDegLat;

        // Anisotropic scale then rotation
        const sx = xMeters * this.sx;
        const sy = yMeters * this.sy;
        const x = sx * this.cosR - sy * this.sinR;
        const y = sx * this.sinR + sy * this.cosR;

        return new Point(x, y);
    }
}

