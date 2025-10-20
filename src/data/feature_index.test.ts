import {describe, expect, test} from 'vitest';
import {FeatureIndex} from './feature_index';
import {type Feature, fromVectorTileJs, GeoJSONWrapper} from '@maplibre/vt-pbf';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {OverscaledTileID} from '../source/tile_id';
import {Tile} from '../source/tile';
import {CircleStyleLayer} from '../style/style_layer/circle_style_layer';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import Point from '@mapbox/point-geometry';
import {CollisionBoxArray} from '../data/array_types.g';
import {extend} from '../util/util';
import {serialize, deserialize} from '../util/web_worker_transfer';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {EvaluationParameters} from '../style/evaluation_parameters';

describe('FeatureIndex', () => {
    describe('getId', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        test('uses cluster_id when cluster is true and id is undefined', () => {
            const featureIndex = new FeatureIndex(tileID, 'someProperty');
            const feature = {
                properties: {
                    cluster: true,
                    cluster_id: '123',
                    promoteId: 'someProperty',
                    someProperty: undefined
                },
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                extent: 4096,
                type: 1,
                loadGeometry: () => [],
                toGeoJSON: () => ({})
            } as unknown as VectorTileFeature;

            expect(featureIndex.getId(feature, 'sourceLayer')).toBe(123); // cluster_id converted to number
        });
    });

    describe('query', () => {
        const features = [
            {
                type: 1,
                geometry: [0, 0],
                tags: {cluster: true}
            }  as any as Feature
        ];
        const tileID = new OverscaledTileID(3, 0, 2, 1, 2);
        const tile = new Tile(tileID, undefined);
        const geojsonWrapper = new GeoJSONWrapper(features);
        geojsonWrapper.name = '_geojsonTileLayer';
        const rawTileData = fromVectorTileJs({layers: {'_geojsonTileLayer': geojsonWrapper}});
        tile.loadVectorData(
            createVectorData({rawTileData}),
            createPainter()
        );
        const transform = new MercatorTransform();
        transform.resize(500, 500);

        test('filter with global-state', () => {
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
    });
});

function createVectorData(options?) {
    const collisionBoxArray = new CollisionBoxArray();
    return extend({
        collisionBoxArray: deserialize(serialize(collisionBoxArray)),
        featureIndex: deserialize(serialize(new FeatureIndex(new OverscaledTileID(1, 0, 1, 1, 1)))),
        buckets: []
    }, options);
}

function createPainter(styleStub = {}) {
    return {style: styleStub};
}
