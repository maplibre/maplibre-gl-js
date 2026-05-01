import {describe, test, expect} from 'vitest';
import {mapObject} from '../util/util';
import {StyleLayerIndex} from './style_layer_index';
import {GEOJSON_TILE_LAYER_NAME} from '../data/feature_index';

describe('StyleLayerIndex', () => {
    test('StyleLayerIndex.replace', () => {
        const index = new StyleLayerIndex([
            {id: '1', type: 'fill', source: 'source', 'source-layer': 'layer', paint: {'fill-color': 'red'}},
            {id: '2', type: 'circle', source: 'source', 'source-layer': 'layer', paint: {'circle-color': 'green'}},
            {id: '3', type: 'circle', source: 'source', 'source-layer': 'layer', paint: {'circle-color': 'blue'}}
        ]);

        const families = index.familiesBySource['source']['layer'];
        expect(families).toHaveLength(2);
        expect(families[0]).toHaveLength(1);
        expect(families[0][0].id).toBe('1');
        expect(families[1]).toHaveLength(2);
        expect(families[1][0].id).toBe('2');
        expect(families[1][1].id).toBe('3');

        index.replace([]);
        expect(index.familiesBySource).toEqual({});

    });

    test('StyleLayerIndex.update', () => {
        const index = new StyleLayerIndex([
            {id: '1', type: 'fill', source: 'foo', 'source-layer': 'layer', paint: {'fill-color': 'red'}},
            {id: '2', type: 'circle', source: 'foo', 'source-layer': 'layer', paint: {'circle-color': 'green'}},
            {id: '3', type: 'circle', source: 'foo', 'source-layer': 'layer', paint: {'circle-color': 'blue'}}
        ]);

        index.update([
            {id: '1', type: 'fill', source: 'bar', 'source-layer': 'layer', paint: {'fill-color': 'cyan'}},
            {id: '2', type: 'circle', source: 'bar', 'source-layer': 'layer', paint: {'circle-color': 'magenta'}},
            {id: '3', type: 'circle', source: 'bar', 'source-layer': 'layer', paint: {'circle-color': 'yellow'}}
        ], []);

        const families = index.familiesBySource['bar']['layer'];
        expect(families).toHaveLength(2);
        expect(families[0]).toHaveLength(1);
        expect(families[0][0].getPaintProperty('fill-color')).toBe('cyan');
        expect(families[1]).toHaveLength(2);
        expect(families[1][0].getPaintProperty('circle-color')).toBe('magenta');
        expect(families[1][0].source).toBe('bar');
        expect(families[1][1].getPaintProperty('circle-color')).toBe('yellow');
        expect(families[1][1].source).toBe('bar');

    });

    test('StyleLayerIndex.familiesBySource', () => {
        const index = new StyleLayerIndex([
            {id: '0', type: 'fill', 'source': 'A', 'source-layer': 'foo'},
            {id: '1', type: 'fill', 'source': 'A', 'source-layer': 'foo'},
            {id: '2', type: 'fill', 'source': 'A', 'source-layer': 'foo', 'minzoom': 1},
            {id: '3', type: 'fill', 'source': 'A', 'source-layer': 'bar'},
            {id: '4', type: 'fill', 'source': 'B', 'source-layer': 'foo'},
            {id: '5', type: 'fill', 'source': 'geojson'},
            {id: '6', type: 'background'}
        ]);

        const ids = mapObject(index.familiesBySource, (bySource) => {
            return mapObject(bySource, (families) => {
                return families.map((family) => {
                    return family.map((layer) => layer.id);
                });
            });
        });

        expect(ids).toEqual({
            'A': {
                'foo': [['0', '1'], ['2']],
                'bar': [['3']]
            },
            'B': {
                'foo': [['4']]
            },
            'geojson': {
                [GEOJSON_TILE_LAYER_NAME]: [['5']]
            },
            '': {
                [GEOJSON_TILE_LAYER_NAME]: [['6']]
            }
        });

    });

    test('StyleLayerIndex groups families even if layout key order differs', () => {
        const index = new StyleLayerIndex([
            {id: '0', type: 'line', 'source': 'source', 'source-layer': 'layer',
                'layout': {'line-cap': 'butt', 'line-join': 'miter'}},
            {id: '1', type: 'line', 'source': 'source', 'source-layer': 'layer',
                'layout': {'line-join': 'miter', 'line-cap': 'butt'}}
        ]);

        const families = index.familiesBySource['source']['layer'];
        expect(families[0]).toHaveLength(2);

    });
});
