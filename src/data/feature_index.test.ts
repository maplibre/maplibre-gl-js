import {FeatureIndex} from './feature_index';
import {OverscaledTileID} from '../source/tile_id';

describe('FeatureIndex', () => {
    describe('getId', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        
        test('converts boolean ids to numbers', () => {
            const featureIndex = new FeatureIndex(tileID, 'someProperty');
            const feature = {
                id: 1,
                properties: {
                    someProperty: true
                }
            };
            
            expect(featureIndex.getId(feature, 'sourceLayer')).toBe(1); // true converted to 1
        });

        test('uses cluster_id when cluster is true and id is undefined', () => {
            const featureIndex = new FeatureIndex(tileID, 'someProperty');
            const feature = {
                id: 1,
                properties: {
                    cluster: true,
                    cluster_id: '123',
                    someProperty: undefined
                }
            };
            
            expect(featureIndex.getId(feature, 'sourceLayer')).toBe(123); // cluster_id converted to number
        });

        test('ignores cluster_id when cluster is false', () => {
            const featureIndex = new FeatureIndex(tileID, 'someProperty');
            const feature = {
                id: 1,
                properties: {
                    cluster: false,
                    cluster_id: '123',
                    someProperty: undefined
                }
            };
            
            expect(featureIndex.getId(feature, 'sourceLayer')).toBeUndefined();
        });
    });
});geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                },
                 as VectorTileFeature