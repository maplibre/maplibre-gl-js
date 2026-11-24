import {describe, test, expect} from 'vitest';
import {CircleStyleLayer} from './circle_style_layer.ts';
import {type CanonicalTileID, UnwrappedTileID} from '../../tile/tile_id.ts';
import Point from '@mapbox/point-geometry';
import {mat4} from 'gl-matrix';
import {createTestCamera} from '../../util/test/util.ts';

import type {EvaluationParameters} from '../evaluation_parameters.ts';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
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
        const {projectedCamera} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true, width: 400, height: 300});

        test('an affine camera picks a map-pitched circle in its painted pixel metric', () => {
            const affine = mat4.create();
            affine[5] = 2;
            const camera = {...projectedCamera, cameraAffine: affine};
            const center = geometry[0][0];
            const layer = createCircleLayer();
            const hit = (x: number, y: number) => layer.queryIntersectsFeature({
                ...params,
                queryGeometry: [new Point(center.x + x, center.y + y)],
                projectedCamera: camera,
                zoom: camera.zoom
            });
            // 12 px of painted radius correspond to 192 tile units in x, 96 in y.
            expect(hit(160, 0)).toBe(true);
            expect(hit(0, 80)).toBe(true);
            expect(hit(0, 160)).toBe(false);
        });

        describe('map pitch alignment', () => {

            describe('map pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer().queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        projectedCamera,
                        ...params
                    } as any)).toBe(true);
                });

                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer().queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        projectedCamera,
                        ...params
                    } as any)).toBe(false);
                });
            });

            describe('viewport pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        projectedCamera,
                        ...params
                    } as any)).toBe(true);
                });

                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        projectedCamera,
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
                        projectedCamera,
                        ...params
                    } as any)).toBe(true);
                });
                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer({pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        projectedCamera,
                        ...params
                    } as any)).toBe(false);
                });
            });

            describe('viewport pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport', pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        projectedCamera,
                        ...params
                    } as any)).toBe(true);
                });

                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport', pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        projectedCamera,
                        ...params
                    } as any)).toBe(false);
                });
            });
        });
    });

    describe('globe projection', () => {
        const {projectedCamera} = createTestCamera({width: 400, height: 300}, {projection: 'globe'});

        describe('map pitch alignment', () => {

            describe('map pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer().queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        projectedCamera,
                        ...params
                    } as any)).toBe(true);
                });

                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer().queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        projectedCamera,
                        ...params
                    } as any)).toBe(false);
                });
            });

            describe('viewport pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        projectedCamera,
                        ...params
                    } as any)).toBe(true);
                });

                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        projectedCamera,
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
                        projectedCamera,
                        ...params
                    } as any)).toBe(true);
                });
                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer({pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        projectedCamera,
                        ...params
                    } as any)).toBe(false);
                });
            });

            describe('viewport pitch scale', () => {
                test('returns `true` when a circle intersects a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport', pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryTrue,
                        projectedCamera,
                        ...params
                    } as any)).toBe(true);
                });

                test('returns `false` when a circle does not intersect a point', () => {
                    expect(createCircleLayer({pitchScale: 'viewport', pitchAlignment: 'viewport'}).queryIntersectsFeature({
                        queryGeometry: queryGeometryFalse,
                        projectedCamera,
                        ...params
                    } as any)).toBe(false);
                });
            });
        });
    });
});
