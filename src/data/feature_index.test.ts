import path from 'path';
import {readFileSync} from 'fs';
import {describe, expect, test} from 'vitest';
import {FeatureIndex, GEOJSON_TILE_LAYER_NAME} from './feature_index';
import {type Feature, fromVectorTileJs, GeoJSONWrapper, type VectorTileFeatureLike} from '@maplibre/vt-pbf';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {OverscaledTileID} from '../tile/tile_id';
import {CircleStyleLayer} from '../style/style_layer/circle_style_layer';
import Point from '@mapbox/point-geometry';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {EvaluationParameters} from '../style/evaluation_parameters';

describe('FeatureIndex', () => {
    describe('getId', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        test('uses cluster_id when cluster is true and id is undefined', () => {
            const featureIndex = new FeatureIndex(tileID, 'someProperty');
            const feature: VectorTileFeatureLike = {
                id: 0,
                properties: {
                    cluster: true,
                    cluster_id: '123',
                    promoteId: 'someProperty',
                    someProperty: undefined
                },
                extent: 4096,
                type: 1,
                loadGeometry: () => [],
            };

            expect(featureIndex.getId(feature, 'sourceLayer')).toBe(123); // cluster_id converted to number
        });
    });

    describe('query', () => {
        const tileID = new OverscaledTileID(3, 0, 2, 1, 2);
        const transform = new MercatorTransform();
        transform.resize(500, 500);

        test('filter with global-state', () => {
            const features = [
                {
                    type: 1,
                    geometry: [0, 0],
                    tags: {cluster: true}
                }  as any as Feature
            ];
            const geojsonWrapper = new GeoJSONWrapper(features);
            geojsonWrapper.name = GEOJSON_TILE_LAYER_NAME;
            const rawTileData = fromVectorTileJs({layers: {[GEOJSON_TILE_LAYER_NAME]: geojsonWrapper}});
            const globalState = {isCluster: true};
            const layer = new CircleStyleLayer({source: 'source', paint: {}} as LayerSpecification, globalState);
            layer.recalculate({} as EvaluationParameters, []);
            const featureIndex = new FeatureIndex(tileID);
            featureIndex.rawTileData = rawTileData as any as ArrayBuffer;
            featureIndex.bucketLayerIDs = [['layer']];
            featureIndex.insert(geojsonWrapper.feature(0), [[new Point(1, 1)]], 0, 0, 0);

            const result = featureIndex.query({
                queryPadding: 0,
                tileSize: 512,
                scale: 1,
                queryGeometry: [new Point(0, 0), new Point(10, 10)],
                cameraQueryGeometry: [new Point(0, 0), new Point(10, 10)],
                params: {
                    filter: ['==', ['get', 'cluster'], ['global-state', 'isCluster']],
                    globalState
                },
                transform
            } as any, {
                layer: layer,
            }, [], undefined);
            expect(result.layer[0].feature.properties).toEqual(features[0].tags);
        });

        test('query mlt tile', () => {
            const layer = new CircleStyleLayer({source: 'source', paint: {}} as LayerSpecification, {});
            layer.recalculate({} as EvaluationParameters, []);
            const featureIndex = new FeatureIndex(tileID);
            const mltRawData = readFileSync(path.join(__dirname, '../../test/integration/assets/tiles/mlt/5/17/10.mlt')).buffer.slice(0) as ArrayBuffer;
            featureIndex.rawTileData = mltRawData;
            featureIndex.encoding = 'mlt';
            featureIndex.bucketLayerIDs = [['layer']];
            featureIndex.insert({} as any, [[new Point(1, 1)]], 0, 0, 0);
            const result = featureIndex.query({
                queryPadding: 0,
                tileSize: 512,
                scale: 1,
                queryGeometry: [new Point(0, 0), new Point(0, 2000), new Point(2000, 2000), new Point(2000, 0), new Point(0 ,0)],
                cameraQueryGeometry: [new Point(0, 0), new Point(10, 10)],
                params: {},
                transform
            } as any, {
                layer: layer,
            }, [], undefined);
            expect(result.layer[0].feature.properties.admin_level).toBeDefined();
            expect(result.layer[0].feature.geometry.type).toBe('LineString');
        });
    });
});
