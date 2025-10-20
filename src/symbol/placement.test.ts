import {beforeEach, describe, expect, test} from 'vitest';
import {Placement, RetainedQueryData} from './placement';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer';
import {type EvaluationParameters} from '../style/evaluation_parameters';
import {CollisionBoxArray, SymbolInstanceArray} from '../data/array_types.g';
import {OverscaledTileID} from '../source/tile_id';
import {FeatureIndex} from '../data/feature_index';

describe('placement', () => {
    let placement: Placement;
    let transform: MercatorTransform;
    beforeEach(() => {
        transform = new MercatorTransform();
        transform.resize(512, 512);
        placement = new Placement(transform, undefined as any, 0, true);
    });

    test('should not throw on integer overflow', () => {
        const layer = new SymbolStyleLayer({
            id: 'contour-label',
            type: 'symbol',
            source: 'contours',
            'source-layer': 'contours',
            layout: {
                'text-font': ['Test'], 
                'text-field': 'test', 
                'symbol-placement': 'line'
            },
        }, {});
        layer.recalculate({zoom: 22, zoomHistory: {}} as EvaluationParameters, undefined);
        const tileId = new OverscaledTileID(22, 0, 12, 2447, 1666);
        const bucketInstanceId = 1;
        placement.retainedQueryData[bucketInstanceId] = new RetainedQueryData(
            bucketInstanceId,
            new FeatureIndex(tileId),
            0,
            0,
            tileId
        );
        const bucket = {
            bucketInstanceId,
            symbolInstances: new SymbolInstanceArray(),
            collisionArrays: {[0]: new CollisionBoxArray()},
        };
        const int16Overflow = Math.pow(2, 15) + 1;
        bucket.symbolInstances.emplaceBack(0, 0, 0, int16Overflow, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0);
        bucket.symbolInstances.get(0).crossTileID = 1;
        expect(() => {
            placement.placeLayerBucketPart({
                symbolInstanceStart: 0,
                symbolInstanceEnd: 1,
                parameters: {
                    layout: layer.layout,
                    bucket
                } as any
            }, {}, false);
        }).not.toThrow();
    });
});