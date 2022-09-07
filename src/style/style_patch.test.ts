import {extend} from '../util/util';
import buildPatchOperations from './style_patch';

function createStyleJSON(properties?) {
    return extend({
        'version': 8,
        'sources': {},
        'layers': []
    }, properties);
}

describe('buildPatchOperations', () => {
    const originalConsoleWarn = console.warn;
    beforeEach(() => {
        console.warn = originalConsoleWarn;
    });

    test('should produce just addLayer operations on preserveLayer in diff mode with originalSource preserved', () => {
        const initial = createStyleJSON({
            'version': 8,
            'sources': {
                'originalSource': {
                    'type': 'vector'
                }
            },
            'layers': [
                {
                    'id': 'initial_0',
                    'source': 'originalSource',
                    'source-layer': 'source-layer',
                    'type': 'fill'
                },
                {
                    'id': 'initial_1',
                    'source': 'originalSource',
                    'source-layer': 'source-layer',
                    'type': 'fill'
                },
                {
                    'id': 'initial_2',
                    'source': 'originalSource',
                    'source-layer': 'source-layer',
                    'type': 'fill'
                }]});

        const next = createStyleJSON({
            'version': 8,
            'sources': {
                'nextSource': {
                    'type': 'vector'
                }
            },
            'layers': [
                {
                    'id': 'next_0',
                    'source': 'nextSource',
                    'source-layer': 'source-layer',
                    'type': 'fill'
                }]});

        const {patchOperations, preservedSources} = buildPatchOperations(
            initial, next,
            (_prev, _next, preserveLayer) => ['initial_0', 'initial_1'].map(layerId => preserveLayer(layerId)),
            true);
        expect(preservedSources).toStrictEqual(['originalSource']);
        expect(patchOperations.reduce((isMove, op) => isMove && op.command === 'addLayer', true)).toBe(true);
    });

    test('should produce addSource, addLayer operations on preserveLayer in no diff mode with original source preserved', () => {
        const initial = createStyleJSON({
            'version': 8,
            'sources': {
                'originalSource': {
                    'type': 'vector'
                }
            },
            'layers': [
                {
                    'id': 'initial_0',
                    'source': 'originalSource',
                    'source-layer': 'source-layer',
                    'type': 'fill'
                },
                {
                    'id': 'initial_1',
                    'source': 'originalSource',
                    'source-layer': 'source-layer',
                    'type': 'fill'
                },
                {
                    'id': 'initial_2',
                    'source': 'originalSource',
                    'source-layer': 'source-layer',
                    'type': 'fill'
                }]});

        const next = createStyleJSON({
            'version': 8,
            'sources': {
                'nextSource': {
                    'type': 'vector'
                }
            },
            'layers': [
                {
                    'id': 'next_0',
                    'source': 'nextSource',
                    'source-layer': 'source-layer',
                    'type': 'fill'
                }]});

        const {patchOperations, preservedSources} = buildPatchOperations(
            initial, next,
            (_prev, _next, preserveLayer) => ['initial_0', 'initial_1'].map(layerId => preserveLayer(layerId)),
            false);
        expect(preservedSources).toStrictEqual(['originalSource']);
        expect(patchOperations.map(op => op.command)).toStrictEqual(['addSource', 'addLayer', 'addLayer']);
    });

    test('updatePaintProperty, updateLayoutProperty, updateFilter operations should be added in diff mode', () => {
        const style = createStyleJSON({
            'sources': {
                'maplibre': {
                    'type': 'vector',
                    'minzoom': 1,
                    'maxzoom': 10,
                    'tiles': ['http://example.com/{z}/{x}/{y}.png']
                }
            },
            'layers': [{
                'id': 'layerId0',
                'type': 'circle',
                'source': 'maplibre',
                'source-layer': 'sourceLayer',
                'paint': {
                    'circle-color': '#000000'
                }
            }]
        });

        const {patchOperations} = buildPatchOperations(
            createStyleJSON(), style,
            (prevStyle, nextStyle, preserveLayer, updatePaintProperty, updateLayoutProperty, updateFilter) => {
                updatePaintProperty(nextStyle.layers[0].id, 'circle-color', '#FF0000');
                updateLayoutProperty(nextStyle.layers[0].id, 'visibility', 'none');
                updateFilter(nextStyle.layers[0].id, ['!=', ['get', 'sample_property'], 'sample_value']);
            },
            true
        );

        expect(patchOperations.map(op => op.command)).toStrictEqual(['setPaintProperty', 'setLayoutProperty', 'setFilter']);
    });

    test('updatePaintProperty, updateLayoutProperty, updateFilter operations should be added in no diff mode', () => {
        const style = createStyleJSON({
            'sources': {
                'maplibre': {
                    'type': 'vector',
                    'minzoom': 1,
                    'maxzoom': 10,
                    'tiles': ['http://example.com/{z}/{x}/{y}.png']
                }
            },
            'layers': [{
                'id': 'layerId0',
                'type': 'circle',
                'source': 'maplibre',
                'source-layer': 'sourceLayer',
                'paint': {
                    'circle-color': '#000000'
                }
            }]
        });

        const {patchOperations} = buildPatchOperations(
            createStyleJSON(), style,
            (prevStyle, nextStyle, preserveLayer, updatePaintProperty, updateLayoutProperty, updateFilter) => {
                updatePaintProperty(nextStyle.layers[0].id, 'circle-color', '#FF0000');
                updateLayoutProperty(nextStyle.layers[0].id, 'visibility', 'none');
                updateFilter(nextStyle.layers[0].id, ['!=', ['get', 'sample_property'], 'sample_value']);
            },
            false
        );

        expect(patchOperations.map(op => op.command)).toStrictEqual(['setPaintProperty', 'setLayoutProperty', 'setFilter']);
    });

    test('updatePaintProperty, updateLayoutProperty, updateFilter called before layer is preserved should generate 3 warnings and not add those operations in no diff mode', () => {
        console.warn = jest.fn();

        const style = createStyleJSON({
            'sources': {
                'maplibre': {
                    'type': 'vector',
                    'minzoom': 1,
                    'maxzoom': 10,
                    'tiles': ['http://example.com/{z}/{x}/{y}.png']
                }
            },
            'layers': [{
                'id': 'layerId0',
                'type': 'circle',
                'source': 'maplibre',
                'source-layer': 'sourceLayer',
                'paint': {
                    'circle-color': '#000000'
                }
            }]
        });

        const {patchOperations} = buildPatchOperations(
            style, createStyleJSON(),
            (prevStyle, nextStyle, preserveLayer, updatePaintProperty, updateLayoutProperty, updateFilter) => {
                updatePaintProperty(prevStyle.layers[0].id, 'circle-color', '#FF0000');
                updateLayoutProperty(prevStyle.layers[0].id, 'visibility', 'none');
                updateFilter(prevStyle.layers[0].id, ['!=', ['get', 'sample_property'], 'sample_value']);
                preserveLayer(prevStyle.layers[0].id);
            },
            false
        );

        expect(console.warn).toHaveBeenCalledTimes(3);
        expect(patchOperations.map(op => op.command)).toStrictEqual(['addSource', 'addLayer']);
    });

    test('preserved missing layer warns once', () => {
        console.warn = jest.fn();

        const initial = createStyleJSON({
            'version': 8,
            'sources': {
                'originalSource': {
                    'type': 'vector'
                }
            },
            'layers': [
                {
                    'id': 'initial_0',
                    'source': 'originalSource',
                    'source-layer': 'source-layer',
                    'type': 'fill'
                }]});

        buildPatchOperations(initial, createStyleJSON(), (_prev, _next, preserveLayer) => {
            preserveLayer('does not exist');
            preserveLayer('does not exist');
        }, false);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith('Cannot preserve layer does not exist that is not in the previous style.');
    });

    test('updatePaintProperty missing layer warns once', () => {
        console.warn = jest.fn();

        const initial = createStyleJSON({
            'version': 8,
            'sources': {
                'originalSource': {
                    'type': 'vector'
                }
            },
            'layers': [
                {
                    'id': 'initial_0',
                    'source': 'originalSource',
                    'source-layer': 'source-layer',
                    'type': 'fill'
                }]});

        buildPatchOperations(initial, createStyleJSON(), (_prev, _next, preserveLayer, updatePaintProperty) => {
            updatePaintProperty('does not exist', 'circle-color', '#FF0000');
            updatePaintProperty('does not exist', 'circle-color', '#FF0000');
        }, false);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith('Cannot update paint property on layer does not exist that is not in the next style.');
    });

    test('updateLayoutProperty missing layer warns once', () => {
        console.warn = jest.fn();

        const initial = createStyleJSON({
            'version': 8,
            'sources': {
                'originalSource': {
                    'type': 'vector'
                }
            },
            'layers': [
                {
                    'id': 'initial_0',
                    'source': 'originalSource',
                    'source-layer': 'source-layer',
                    'type': 'fill'
                }]});

        buildPatchOperations(initial, createStyleJSON(), (_prev, _next, preserveLayer, updatePaintProperty, updateLayoutProperty) => {
            updateLayoutProperty('does not exist', 'visibility', 'none');
            updateLayoutProperty('does not exist', 'visibility', 'none');
        }, false);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith('Cannot update layout property on layer does not exist that is not in the next style.');
    });

    test('updateFilter missing layer warns once', () => {
        console.warn = jest.fn();

        const initial = createStyleJSON({
            'version': 8,
            'sources': {
                'originalSource': {
                    'type': 'vector'
                }
            },
            'layers': [
                {
                    'id': 'initial_0',
                    'source': 'originalSource',
                    'source-layer': 'source-layer',
                    'type': 'fill'
                }]});

        buildPatchOperations(initial, createStyleJSON(), (_prev, _next, preserveLayer, updatePaintProperty, updateLayoutProperty, updateFilter) => {
            updateFilter('does not exist', ['!=', ['get', 'sample_property'], 'sample_value']);
            updateFilter('does not exist', ['!=', ['get', 'sample_property'], 'sample_value']);
        }, false);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith('Cannot update filter on layer does not exist that is not in the next style.');
    });

    test('layer id and source id collision during preserve will add a combination of removeLayer and addLayer op in diff mode', () => {
        const initial = createStyleJSON({
            'sources': {
                'originalSource': {'type': 'vector'}
            },
            'layers': [{
                'id': 'test',
                'source': 'originalSource',
                'source-layer': 'source-layer',
                'type': 'line'
            }]
        });

        const next = createStyleJSON({
            'sources': {
                'originalSource': {'type': 'vector'}
            },
            'layers': [{
                'id': 'test',
                'source': 'originalSource',
                'source-layer': 'source-layer',
                'type': 'fill'
            }]
        });

        const {patchOperations, preservedSources} = buildPatchOperations(
            initial, next,
            (_prev, _next, preserveLayer) => preserveLayer('test'),
            true);
        // previous source should not be preserved
        expect(preservedSources).toStrictEqual([]);
        // previous source should not be preserved
        expect(patchOperations.map(op => op.command)).toStrictEqual(['removeLayer', 'addLayer']);
    });

    test('layer id and source collision during preserve will add a combination of removeLayer and addLayer op in no diff mode', () => {
        const initial = createStyleJSON({
            'sources': {
                'originalSource': {'type': 'vector'}
            },
            'layers': [{
                'id': 'test',
                'source': 'originalSource',
                'source-layer': 'source-layer',
                'type': 'line'
            }]
        });

        const next = createStyleJSON({
            'sources': {
                'originalSource': {'type': 'vector'}
            },
            'layers': [{
                'id': 'test',
                'source': 'originalSource',
                'source-layer': 'source-layer',
                'type': 'fill'
            }]
        });

        const {patchOperations, preservedSources} = buildPatchOperations(
            initial, next,
            (_prev, _next, preserveLayer) => preserveLayer('test'),
            false);
        // previous source should not be preserved
        expect(preservedSources).toStrictEqual([]);
        // previous source should not be preserved
        expect(patchOperations.map(op => op.command)).toStrictEqual(['removeLayer', 'addLayer']);
    });
});
