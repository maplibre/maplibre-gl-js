import {describe, test, expect} from 'vitest';
import {createStyleLayer} from '../create_style_layer.ts';
import {extend} from '../../util/util.ts';
import {type LineStyleLayer} from './line_style_layer.ts';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../evaluation_parameters.ts';
import {MercatorTransform} from '../../geo/projection/mercator_transform.ts';
import Point from '@mapbox/point-geometry';
import type {VectorTileFeatureLike} from '@maplibre/vt-pbf';

describe('LineStyleLayer', () => {
    function createLineLayer(layer?) {
        return extend({
            type: 'line',
            source: 'line',
            id: 'line',
            paint: {
                'line-color': 'red',
                'line-width': 14,
                'line-gradient': [
                    'interpolate',
                    ['linear'],
                    ['line-progress'],
                    0,
                    'blue',
                    1,
                    'red'
                ]
            }
        }, layer);
    }

    test('updating with valid line-gradient updates this.gradientVersion', () => {
        const lineLayer = createStyleLayer(createLineLayer(), {}) as LineStyleLayer;
        const gradientVersion = lineLayer.gradientVersion;

        lineLayer.setPaintProperty('line-gradient', [
            'interpolate',
            ['linear'],
            ['line-progress'],
            0,
            'red',
            1,
            'blue'
        ]);
        expect(lineLayer.gradientVersion).toBeGreaterThan(gradientVersion);
    });

    test('updating with invalid line-gradient updates this.gradientVersion', () => {
        const lineLayer = createStyleLayer(createLineLayer(), {}) as LineStyleLayer;
        const gradientVersion = lineLayer.gradientVersion;

        lineLayer.setPaintProperty('line-gradient', null);
        expect(lineLayer.gradientVersion).toBeGreaterThan(gradientVersion);
    });

});

describe('LineStyleLayer.queryIntersectsFeature with tapered lines', () => {
    const feature = {} as VectorTileFeatureLike;
    const featureState = {};

    function createTaperLayer(paint): LineStyleLayer {
        const layer = createStyleLayer({
            type: 'line',
            source: 'line',
            id: 'line',
            paint: {
                'line-color': 'red',
                'line-width': 2,
                'line-translate': [0, 0],
                'line-translate-anchor': 'map',
                ...paint
            }
        } as unknown as LayerSpecification, {}) as LineStyleLayer;
        layer.recalculate({} as EvaluationParameters, []);
        return layer;
    }

    // A horizontal line from (0,0) to (100,0) in tile units. The taper goes from
    // line-width-start=20 at t=0 to line-width-end=2 at t=1, so the half width is
    // 10 at the start and 1 at the end: half(t) = 10 - 9*t (pixelsToTileUnits=1).
    const geometry = [[new Point(0, 0), new Point(100, 0)]];
    const pixelsToTileUnits = 1;
    const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
    transform.resize(400, 300);

    function query(point: Point): boolean {
        return createTaperLayer({
            'line-width-start': 20,
            'line-width-end': 2
        }).queryIntersectsFeature({
            queryGeometry: [point],
            feature,
            featureState,
            geometry,
            transform,
            pixelsToTileUnits
        } as any);
    }

    test('hits exactly where the tapered line is wide enough', () => {
        // On the line itself.
        expect(query(new Point(0, 0))).toBe(true);
        expect(query(new Point(50, 0))).toBe(true);
        expect(query(new Point(100, 0))).toBe(true);

        // At t=0.05 the half width is ~9.55: 6 px away hits, 11 px away does not.
        expect(query(new Point(5, 6))).toBe(true);
        expect(query(new Point(5, 11))).toBe(false);

        // At t=0.5 the half width is 5.5: 5 px away hits, 8 px away does not
        // (a constant max-width hit test using 20 would still hit at 8 px).
        expect(query(new Point(50, 5))).toBe(true);
        expect(query(new Point(50, 8))).toBe(false);

        // At t=0.95 the half width is ~1.45: 1.4 px away hits, 2 px away does not.
        expect(query(new Point(95, 1.4))).toBe(true);
        expect(query(new Point(95, 2))).toBe(false);
    });

    test('falls back to line-width for an unset side', () => {
        const layer = createTaperLayer({'line-width-end': 20});

        // Only the end is set (20 at t=1); the start falls back to line-width=2,
        // so at t=0.5 the width is 11 and the half width 5.5.
        const result = layer.queryIntersectsFeature({
            queryGeometry: [new Point(50, 8)],
            feature,
            featureState,
            geometry,
            transform,
            pixelsToTileUnits
        } as any);
        expect(result).toBe(false);

        const resultNear = layer.queryIntersectsFeature({
            queryGeometry: [new Point(50, 5)],
            feature,
            featureState,
            geometry,
            transform,
            pixelsToTileUnits
        } as any);
        expect(resultNear).toBe(true);
    });

    test('a polygon query is matched against every sampled local radius', () => {
        const layer = createTaperLayer({
            'line-width-start': 20,
            'line-width-end': 2
        });
        // A small box centred on x=50 (half width there is 5.5) that touches the line.
        const box = [new Point(46, 4), new Point(54, 4), new Point(54, 6), new Point(46, 6), new Point(46, 4)];
        expect(layer.queryIntersectsFeature({
            queryGeometry: box,
            feature,
            featureState,
            geometry,
            transform,
            pixelsToTileUnits
        } as any)).toBe(true);
        // A box far from the thin end of the line (x=95, half width ~1.45).
        const farBox = [new Point(90, 10), new Point(100, 10), new Point(100, 12), new Point(90, 12), new Point(90, 10)];
        expect(layer.queryIntersectsFeature({
            queryGeometry: farBox,
            feature,
            featureState,
            geometry,
            transform,
            pixelsToTileUnits
        } as any)).toBe(false);
    });

    test('per-vertex line-widths hit exactly where the line is drawn', () => {
        const layer = createTaperLayer({
            'line-widths': [20, 2]
        });

        // 2-vertex line (0,0)->(100,0), widths 20 at t=0 and 2 at t=1:
        // half width 10 at start, 1 at end. Around x=50 the half width is 5.5.
        const query = (point: Point) => layer.queryIntersectsFeature({
            queryGeometry: [point],
            feature,
            featureState,
            geometry,
            transform,
            pixelsToTileUnits
        } as any);

        expect(query(new Point(0, 0))).toBe(true);
        expect(query(new Point(100, 0))).toBe(true);
        // At the thick start.
        expect(query(new Point(0, 9))).toBe(true);
        expect(query(new Point(0, 11))).toBe(false);
        // At the middle (half width 5.5).
        expect(query(new Point(50, 5))).toBe(true);
        expect(query(new Point(50, 8))).toBe(false);
        // At the thin end (half width 1).
        expect(query(new Point(100, 0.9))).toBe(true);
        expect(query(new Point(100, 1.5))).toBe(false);
    });

    test('per-vertex line-widths respect intermediate vertex widths', () => {
        const layer = createTaperLayer({
            'line-widths': [2, 20, 40]
        });

        // 3-vertex line (0,0)->(50,0)->(100,0), widths 2 / 20 / 40 at the vertices,
        // so the half width at the middle vertex is 10.
        const midGeometry = [[new Point(0, 0), new Point(50, 0), new Point(100, 0)]];
        const query = (point: Point) => layer.queryIntersectsFeature({
            queryGeometry: [point],
            feature,
            featureState,
            geometry: midGeometry,
            transform,
            pixelsToTileUnits
        } as any);

        expect(query(new Point(0, 0))).toBe(true);
        // At the middle vertex the width is 20 -> half 10.
        expect(query(new Point(50, 9))).toBe(true);
        expect(query(new Point(50, 11))).toBe(false);
        // At the end the width is 40 -> half 20.
        expect(query(new Point(100, 15))).toBe(true);
        expect(query(new Point(100, 21))).toBe(false);
    });

});
