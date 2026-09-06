import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {GeoJSONVT} from '@maplibre/geojson-vt';
import {EXTENT} from '../data/extent.ts';
import {interpolateWidthProfile} from '../util/interpolate_widths.ts';
import {
    annotateGeoJSONTileFeature,
    buildTaperRegistry,
    expandTaperKnots,
    matchTaperProfile,
    type GeoJSONTaperAnnotation
} from './geojson_taper.ts';
import type {CanonicalTileID} from '../tile/tile_id.ts';

describe('geojson taper anchoring', () => {

    // A line along the equator from 10 to 20 degrees east. Mercator x is linear in
    // longitude, so the normalized arc position of a point on this line is simply
    // (lng - 10) / 10. The widths deliberately have a huge contrast so any leftover
    // tile-boundary artifact would be obvious.
    const widths = [90, 4, 40];
    const originalKnots = [0, 0.5, 1];
    const data = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: {widths},
            geometry: {type: 'LineString', coordinates: [[10, 0], [15, 0], [20, 0]]}
        }]
    };
    const vertexWidth = (knot: number) => interpolateWidthProfile(widths, originalKnots, knot);

    const registry = buildTaperRegistry(data as any);
    const index = new GeoJSONVT(data as any, {extent: EXTENT, buffer: 256, maxZoom: 12, tolerance: 0});

    const z = 12;
    const tileLeftLng = (x: number) => (x / (1 << z)) * 360 - 180;
    const knotAtLng = (lng: number) => 0.5 + ((lng - 15) / 5) * 0.5; // inside segment B->C

    function annotateTile(x: number): {annotation: GeoJSONTaperAnnotation; line: number[][]} {
        const tile = index.getTile(z, x, 2048);
        expect(tile).toBeTruthy();
        const feature = tile.features[0];
        annotateGeoJSONTileFeature(feature, {z, x, y: 2048} as unknown as CanonicalTileID, registry);
        const annotation = (feature as {_taper?: GeoJSONTaperAnnotation})._taper;
        expect(annotation).toBeDefined();
        // Line tile geometry: array of lines, each an array of [x, y] pairs.
        const line = (feature.geometry as unknown as number[][][])[0].map((p) => [p[0], p[1]]);
        expect(annotation.pieceKnots).toHaveLength(1);
        expect(annotation.pieceKnots[0]).toHaveLength(line.length);
        return {annotation, line};
    }

    // The width the GPU actually renders at a world position: linear blend between
    // the two bracketing piece vertices' profile values (the shader interpolates
    // the per-vertex taper values the same way).
    function renderedWidthAt(annotation: GeoJSONTaperAnnotation, line: number[][], tileX: number, worldX: number): number {
        const knots = annotation.pieceKnots[0];
        const toWorldX = (vx: number) => (tileX * EXTENT + vx) / (EXTENT * (1 << z));
        for (let i = 1; i < line.length; i++) {
            const x0 = toWorldX(line[i - 1][0]);
            const x1 = toWorldX(line[i][0]);
            if ((worldX >= Math.min(x0, x1) && worldX <= Math.max(x0, x1))) {
                const f = x1 !== x0 ? (worldX - x0) / (x1 - x0) : 0;
                const v0 = vertexWidth(knots[i - 1]);
                const v1 = vertexWidth(knots[i]);
                return v0 + (v1 - v0) * f;
            }
        }
        throw new Error(`worldX ${worldX} not covered by the piece`);
    }

    test('records profiles for features with numeric-array properties', () => {
        const info = registry.get(data.features[0].properties);
        expect(info).toBeDefined();
        expect(info!.rings).toHaveLength(1);
        expect(info!.profiles.widths.values).toEqual(widths);
        // One value per original vertex, anchored exactly at the vertices.
        const profileKnots = info!.profiles.widths.knotsPerRing[0];
        expect(profileKnots[0]).toBe(0);
        expect(profileKnots[1]).toBeCloseTo(0.5, 12);
        expect(profileKnots[2]).toBe(1);
    });

    test('original vertices keep their exact width in a clipped piece', () => {
        // Tile 2218 contains the original middle vertex B (15 deg, knot 0.5, 4px).
        const {annotation} = annotateTile(2218);
        const knots = annotation.pieceKnots[0];
        // geojson-vt quantizes tile coordinates to whole units, so the recovered
        // knot of an original vertex is exact up to that quantization (the
        // resulting width error is orders of magnitude below a pixel).
        const indexB = knots.findIndex((k) => Math.abs(k - 0.5) < 1e-4);
        expect(indexB).toBeGreaterThanOrEqual(0);
        expect(vertexWidth(knots[indexB])).toBeCloseTo(4, 3);
    });

    test('a piece without any original vertex still gets correct anchors', () => {
        // Tile 2219 lies entirely inside segment B->C: its piece consists of two
        // cut points only. The legacy code normalized the profile over the piece
        // and started it at widths[0] = 90 — the sawtooth at tile boundaries.
        const {annotation} = annotateTile(2219);
        const knots = annotation.pieceKnots[0];
        expect(knots.length).toBeGreaterThanOrEqual(2);
        for (const knot of knots) {
            expect(knot).toBeGreaterThan(0.5);
            expect(knot).toBeLessThan(1);
            // Neither the 90px start nor the exact end value may leak into the middle.
            const w = vertexWidth(knot);
            expect(w).toBeGreaterThan(4);
            expect(w).toBeLessThan(40);
        }
        // Monotonic: pieces preserve the original traversal order.
        for (let i = 1; i < knots.length; i++) {
            expect(knots[i]).toBeGreaterThanOrEqual(knots[i - 1]);
        }
    });

    test('both tiles render the same width at the shared tile boundary', () => {
        const a = annotateTile(2218);
        const b = annotateTile(2219);
        // The boundary between tiles 2218 and 2219.
        const boundaryWorldX = 2219 / (1 << z);
        const boundaryLng = tileLeftLng(2219);
        const expected = vertexWidth(knotAtLng(boundaryLng));

        const widthA = renderedWidthAt(a.annotation, a.line, 2218, boundaryWorldX);
        const widthB = renderedWidthAt(b.annotation, b.line, 2219, boundaryWorldX);

        // Both sides agree with the analytic profile and with each other. The
        // residual (~1e-5 px) comes from geojson-vt's integer tile coordinate
        // quantization — invisible by four orders of magnitude.
        expect(widthA).toBeCloseTo(expected, 3);
        expect(widthB).toBeCloseTo(expected, 3);
        expect(Math.abs(widthA - widthB)).toBeLessThan(1e-3);
    });

    test('matchTaperProfile resolves by reference and by value', () => {
        const annotation: GeoJSONTaperAnnotation = {
            pieceKnots: [[0, 1]],
            profiles: {widths: {values: widths, knotsPerRing: [[0, 0.5, 1]]}}
        };
        expect(matchTaperProfile(annotation, widths)).toBe(annotation.profiles.widths);
        expect(matchTaperProfile(annotation, [90, 4, 40])).toBe(annotation.profiles.widths);
        expect(matchTaperProfile(annotation, [1, 2, 3])).toBeNull();
    });

    test('expandTaperKnots blends knots at subdivision-inserted vertices', () => {
        const raw = [new Point(0, 0), new Point(10, 0)];
        const knots = [0.25, 0.75];
        const subdivided = [new Point(0, 0), new Point(5, 0), new Point(10, 0)];
        expect(expandTaperKnots(raw, subdivided, knots)).toEqual([0.25, 0.5, 0.75]);
        // Same length: unchanged.
        expect(expandTaperKnots(raw, [new Point(0, 0), new Point(10, 0)], knots)).toEqual([0.25, 0.75]);
        // Multiple inserted vertices on one segment: each gets its geometric
        // fraction between the segment's endpoint knots.
        expect(expandTaperKnots(raw, [new Point(0, 0), new Point(5, 0), new Point(7, 0), new Point(10, 0)], knots)).toEqual([0.25, 0.5, 0.6, 0.75]);
    });
});

describe('geojson taper anchoring: self-overlapping (retraced) lines', () => {
    // Outbound pass 10→20°E with THIN width, return pass 20→10°E with THICK width —
    // the return pass lies EXACTLY on the outbound segments. A tile piece that only
    // covers return-pass geometry must resolve its knots on the RETURN arc (thick),
    // not on the earlier outbound strand: before the windowed monotone projection,
    // the globally-nearest scan picked the earlier strand (residual exactly 0 beats
    // the quantized own vertex) and the widths slid onto the wrong pass — visible as
    // thick sections that wander through hand-drawn scribbles while they grow.
    const widths = [4, 4, 4, 90, 90];
    const data = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: {widths},
            geometry: {type: 'LineString', coordinates: [[10, 5], [15, 5], [20, 5], [15, 5], [10, 5]]}
        }]
    };
    const registry = buildTaperRegistry(data as any);
    const index = new GeoJSONVT(data as any, {extent: EXTENT, buffer: 256, maxZoom: 12, tolerance: 0});

    test('return-pass pieces resolve knots on the return arc, not on the overlapped earlier strand', () => {
        const z = 12;
        // A tile fully inside the retrace region (lng ≈ 15.9): both passes cross it,
        // each entering/exiting separately → separate pieces per pass.
        const x = Math.floor(((15.9 + 180) / 360) * (1 << z));
        const tile = index.getTile(z, x, 1991);
        expect(tile).toBeTruthy();
        // geojson-vt liefert HIER ein Feature mit ZWEI Piece-Lines (Outbound- und
        // Return-Pass kreuzen das Tile getrennt) — der alte Guard warf die
        // Annotation komplett weg. Jetzt: beide Lines sind annotiert.
        const knotSets: number[][] = [];
        for (const feature of tile.features) {
            annotateGeoJSONTileFeature(feature, {z, x, y: 1991} as unknown as CanonicalTileID, registry);
            const annotation = (feature as {_taper?: GeoJSONTaperAnnotation})._taper;
            if (!annotation) continue;
            expect(annotation.pieceKnots.length).toBe(feature.geometry.length);
            knotSets.push(...annotation.pieceKnots);
        }
        expect(knotSets.length).toBeGreaterThanOrEqual(2);
        // Outbound-Pass: erste Ring-Hälfte (dünne Zone), Return: zweite (dicke).
        expect(knotSets.some((k) => k.every((v) => v < 0.55))).toBe(true);
        expect(knotSets.some((k) => k.every((v) => v > 0.45))).toBe(true);
    });
});
