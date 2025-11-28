import {describe, test, expect} from 'vitest';
import {HeatmapStyleLayer} from './heatmap_style_layer';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../evaluation_parameters';
import {type CanonicalTileID, UnwrappedTileID} from '../../tile/tile_id';
import Point from '@mapbox/point-geometry';
import {GlobeTransform} from '../../geo/projection/globe_transform';
import {MercatorTransform} from '../../geo/projection/mercator_transform';
import type {VectorTileFeatureLike} from '@maplibre/vt-pbf';

describe('HeatmapStyleLayer.queryIntersectsFeature', () => {
    const feature = {} as VectorTileFeatureLike;
    const featureState = {};
    const geometry = [[new Point(4645, 3729)]];
    const pixelsToTileUnits = 16;
    const unwrappedTileID = new UnwrappedTileID(0, {z: 2, x: 0, y: 1} as CanonicalTileID);
    const getElevation = () => 0;
    const queryGeometryTrue = [new Point(4640, 3725)];
    const queryGeometryFalse = [new Point(6052, 6178)];
    const params = {
        feature,
        featureState,
        geometry,
        pixelsToTileUnits,
        unwrappedTileID,
        getElevation
    };

    function createHeatmapLayer() {
        const heatmapLayer = new HeatmapStyleLayer({
            id: 'heatmap',
            type: 'heatmap',
            paint: {
                'heatmap-radius': 10
            }
        } as LayerSpecification, {});
        heatmapLayer.recalculate({} as EvaluationParameters, []);
        return heatmapLayer;
    }

    describe('Mercator projection', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        transform.resize(400, 300);

        test('returns `true` when a heatmap intersects a point', () => {
            expect(createHeatmapLayer().queryIntersectsFeature({
                queryGeometry: queryGeometryTrue,
                transform,
                ...params
            } as any)).toBe(true);
        });

        test('returns `false` when a heatmap does not intersect a point', () => {
            expect(createHeatmapLayer().queryIntersectsFeature({
                queryGeometry: queryGeometryFalse,
                transform,
                ...params
            } as any)).toBe(false);
        });
    });

    describe('Globe projection', () => {
        const transform = new GlobeTransform();
        transform.resize(400, 300);

        test('returns `true` when a heatmap intersects a point', () => {
            expect(createHeatmapLayer().queryIntersectsFeature({
                queryGeometry: queryGeometryTrue,
                transform,
                ...params
            } as any)).toBe(true);
        });

        test('returns `false` when a heatmap does not intersect a point', () => {
            expect(createHeatmapLayer().queryIntersectsFeature({
                queryGeometry: queryGeometryFalse,
                transform,
                ...params
            } as any)).toBe(false);
        });
    });
});
