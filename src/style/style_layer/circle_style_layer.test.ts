import {describe, test, expect} from 'vitest';
import {CircleStyleLayer} from './circle_style_layer';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../evaluation_parameters';
import {type CanonicalTileID, UnwrappedTileID} from '../../tile/tile_id';
import Point from '@mapbox/point-geometry';
import {GlobeTransform} from '../../geo/projection/globe_transform';
import {MercatorTransform} from '../../geo/projection/mercator_transform';
import type {VectorTileFeatureLike} from '@maplibre/vt-pbf';

describe('CircleStyleLayer.queryIntersectsFeature', () => {
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

    function createCircleLayer({
        pitchScale = 'map',
        pitchAlignment = 'map'
    } = {}) {
        const circleLayer = new CircleStyleLayer({
            id: 'circle',
            type: 'circle',
            paint: {
                'circle-radius': 10,
                'circle-stroke-width': 2,
                'circle-translate': [0, 0],
                'circle-translate-anchor': 'map',
                'circle-pitch-scale': pitchScale,
                'circle-pitch-alignment': pitchAlignment
            }
        } as LayerSpecification, {});
        circleLayer.recalculate({} as EvaluationParameters, []);
        return circleLayer;
    }

    describe('Mercator projection', () => {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        transform.resize(400, 300);

        describe('map pitch alignment', () => {

            describe('map pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer().queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        transform,
                        ...params
                    } as any)).toBe(true);
                });

                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer().queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        transform,
                        ...params
                    } as any)).toBe(false);
                });
            });

            describe('viewport pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        transform,
                        ...params
                    } as any)).toBe(true);
                });

                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        transform,
                        ...params
                    } as any)).toBe(false);
                });
            });
        });

        describe('viewport pitch alignment', () => {

            describe('map pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer({pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        transform,
                        ...params
                    } as any)).toBe(true);
                });
                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer({pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        transform,
                        ...params
                    } as any)).toBe(false);
                });
            });

            describe('viewport pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport', pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        transform,
                        ...params
                    } as any)).toBe(true);
                });

                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport', pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        transform,
                        ...params
                    } as any)).toBe(false);
                });
            });
        });
    });

    describe('globe projection', () => {
        const transform = new GlobeTransform();
        transform.resize(400, 300);

        describe('map pitch alignment', () => {

            describe('map pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer().queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        transform,
                        ...params
                    } as any)).toBe(true);
                });

                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer().queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        transform,
                        ...params
                    } as any)).toBe(false);
                });
            });

            describe('viewport pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        transform,
                        ...params
                    } as any)).toBe(true);
                });

                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        transform,
                        ...params
                    } as any)).toBe(false);
                });
            });
        });

        describe('viewport pitch alignment', () => {

            describe('map pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer({pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        transform,
                        ...params
                    } as any)).toBe(true);
                });
                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer({pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        transform,
                        ...params
                    } as any)).toBe(false);
                });
            });

            describe('viewport pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport', pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        transform,
                        ...params
                    } as any)).toBe(true);
                });

                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport', pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        transform,
                        ...params
                    } as any)).toBe(false);
                });
            });
        });
    });
});
