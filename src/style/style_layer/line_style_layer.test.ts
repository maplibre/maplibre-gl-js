import {describe, test, expect, vi, beforeEach} from 'vitest';
import {createStyleLayer} from '../create_style_layer';
import {extend} from '../../util/util';
import {type LineStyleLayer} from './line_style_layer';
import {type QueryIntersectsFeatureParams} from '../style_layer';
import {MercatorTransform} from '../../geo/projection/mercator_transform';
import Point from '@mapbox/point-geometry';
import type {VectorTileFeature} from '@mapbox/vector-tile';

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

    describe('queryIntersectsFeature', () => {
        beforeEach(() => {
            lineLayer.paint.get('line-offset').evaluate = vi.fn(((_feature, _featureState) => 0));
        });
        const lineLayer = createStyleLayer({'type': 'line', 'id': 'line', 'source': 'line', 'paint': {}}, {}) as LineStyleLayer;
        const transform = new MercatorTransform();
        const feature = {
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: []
            },
            extent: 4096,
            type: 1,
            loadGeometry: () => [],
            toGeoJSON: () => ({})
        } as unknown as VectorTileFeature;

        test('queryIntersectsFeature true for offset line with duplicate points', () => {

            // Mock evaluated value for line-offset
            lineLayer.paint.get('line-offset').evaluate = vi.fn(((_feature, _featureState) => 3));

            const params = {
                queryGeometry: [new Point(0, 3)],
                feature: feature,
                featureState: {},
                geometry: [[new Point(3, 2), new Point(3, 3), new Point(3, 3), new Point(3, 4), new Point(3, 4)]],
                transform: transform,
                pixelsToTileUnits: 1
            } as unknown as QueryIntersectsFeatureParams;
            const result = lineLayer.queryIntersectsFeature(
                params
            );
            expect(result).toBeTruthy();
        });

        test('queryIntersectsFeature with line-offset', () => {
            // Mock evaluated value for line-offset
            lineLayer.paint.get('line-offset').evaluate = vi.fn(((_feature, _featureState) => 3));

            const params = {
                queryGeometry: [new Point(0, 3)],
                feature: feature,
                featureState: {},
                geometry: [[new Point(3, 2), new Point(3, 3), new Point(3, 5), new Point(3, 6), new Point(4, 4)]],
                transform: transform,
                pixelsToTileUnits: 1
            } as unknown as QueryIntersectsFeatureParams;
            const result = lineLayer.queryIntersectsFeature(
                params
            );
            expect(result).toBeTruthy();
        });

        test('queryIntersectsFeature with duplicate points', () => {
            const params = {
                queryGeometry: [new Point(3, 3)],
                feature: feature,
                featureState: {},
                geometry: [[new Point(3, 2), new Point(3, 3), new Point(3, 3), new Point(3, 5), new Point(3, 5)]],
                transform: transform,
                pixelsToTileUnits: 1
            } as unknown as QueryIntersectsFeatureParams;
            const result = lineLayer.queryIntersectsFeature(
                params
            );
            expect(result).toBeTruthy();
        });
    });
});
