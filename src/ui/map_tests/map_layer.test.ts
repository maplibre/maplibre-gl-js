import {describe, beforeEach, afterEach, test, expect} from 'vitest';
import {createMap, beforeMapTest, createStyle, waitForEvent} from '../../util/test/util';
import {extend} from '../../util/util';
import {type EvaluationParameters} from '../../style/evaluation_parameters';
import {fakeServer, type FakeServer} from 'nise';
import {MessageType} from '../../util/actor_messages';

let server: FakeServer;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});

test('moveLayer', async () => {
    const map = createMap({
        style: extend(createStyle(), {
            sources: {
                mapbox: {
                    type: 'vector',
                    minzoom: 1,
                    maxzoom: 10,
                    tiles: ['http://example.com/{z}/{x}/{y}.png']
                }
            },
            layers: [{
                id: 'layerId1',
                type: 'circle',
                source: 'mapbox',
                'source-layer': 'sourceLayer'
            }, {
                id: 'layerId2',
                type: 'circle',
                source: 'mapbox',
                'source-layer': 'sourceLayer'
            }]
        })
    });

    await map.once('render');
    map.moveLayer('layerId1', 'layerId2');
    expect(map.getLayer('layerId1').id).toBe('layerId1');
    expect(map.getLayer('layerId2').id).toBe('layerId2');
});

test('getLayer', async () => {
    const layer = {
        id: 'layerId',
        type: 'circle',
        source: 'mapbox',
        'source-layer': 'sourceLayer'
    };
    const map = createMap({
        style: extend(createStyle(), {
            sources: {
                mapbox: {
                    type: 'vector',
                    minzoom: 1,
                    maxzoom: 10,
                    tiles: ['http://example.com/{z}/{x}/{y}.png']
                }
            },
            layers: [layer]
        })
    });

    await map.once('render');
    const mapLayer = map.getLayer('layerId');
    expect(mapLayer.id).toBe(layer.id);
    expect(mapLayer.type).toBe(layer.type);
    expect(mapLayer.source).toBe(layer.source);
});

test('removeLayer restores Map.loaded() to true', async () => {
    const map = createMap({
        style: extend(createStyle(), {
            sources: {
                mapbox: {
                    type: 'vector',
                    minzoom: 1,
                    maxzoom: 10,
                    tiles: ['http://example.com/{z}/{x}/{y}.png']
                }
            },
            layers: [{
                id: 'layerId',
                type: 'circle',
                source: 'mapbox',
                'source-layer': 'sourceLayer'
            }]
        })
    });

    await map.once('render');
    map.removeLayer('layerId');
    await waitForEvent(map, 'render', () => map.loaded());
    map.remove();
});

describe('getLayersOrder', () => {
    test('returns ids of layers in the correct order', async () => {
        const map = createMap({
            style: extend(createStyle(), {
                'sources': {
                    'raster': {
                        type: 'raster',
                        tiles: ['http://tiles.server']
                    }
                },
                'layers': [{
                    'id': 'raster',
                    'type': 'raster',
                    'source': 'raster'
                }]
            })
        });

        await map.once('style.load');
        map.addLayer({
            id: 'custom',
            type: 'custom',
            render() {}
        }, 'raster');
        expect(map.getLayersOrder()).toEqual(['custom', 'raster']);
    });
});

describe('setLayoutProperty', () => {
    test('sets property', async () => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'geojson': {
                        'type': 'geojson',
                        'data': {
                            'type': 'FeatureCollection',
                            'features': []
                        }
                    }
                },
                'layers': [{
                    'id': 'symbol',
                    'type': 'symbol',
                    'source': 'geojson',
                    'layout': {
                        'text-transform': 'uppercase'
                    }
                }]
            }
        });

        await map.once('style.load');
        map.style.dispatcher.broadcast = function (key, value: any) {
            expect(key).toBe(MessageType.updateLayers);
            expect(value.layers.map((layer) => { return layer.id; })).toEqual(['symbol']);
            return Promise.resolve({} as any);
        };

        map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
        map.style.update({} as EvaluationParameters);
        expect(map.getLayoutProperty('symbol', 'text-transform')).toBe('lowercase');
    });

    test('throw before loaded', () => {
        const map = createMap({
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });

        expect(() => {
            map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
        }).toThrow(Error);

    });

    test('fires an error if layer not found', async () => {
        const map = createMap({
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });

        await map.once('style.load');
        const errorPromise = map.once('error');
        map.setLayoutProperty('non-existant', 'text-transform', 'lowercase');
        const error = await errorPromise;
        expect(error.error.message).toMatch(/Cannot style non-existing layer "non-existant"./);
    });

    test('fires a data event', async () => {
        // background layers do not have a source
        const map = createMap({
            style: {
                'version': 8,
                'sources': {},
                'layers': [{
                    'id': 'background',
                    'type': 'background',
                    'layout': {
                        'visibility': 'none'
                    }
                }]
            }
        });

        await map.once('style.load');
        const dataPromise = map.once('data');
        map.setLayoutProperty('background', 'visibility', 'visible');
        const e = await dataPromise;
        expect(e.dataType).toBe('style');
    });

    test('sets visibility on background layer', async () => {
        // background layers do not have a source
        const map = createMap({
            style: {
                'version': 8,
                'sources': {},
                'layers': [{
                    'id': 'background',
                    'type': 'background',
                    'layout': {
                        'visibility': 'none'
                    }
                }]
            }
        });

        await map.once('style.load');
        map.setLayoutProperty('background', 'visibility', 'visible');
        expect(map.getLayoutProperty('background', 'visibility')).toBe('visible');
    });

    test('sets visibility on raster layer', async () => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'maplibre-satellite': {
                        'type': 'raster',
                        'tiles': ['http://example.com/{z}/{x}/{y}.png']
                    }
                },
                'layers': [{
                    'id': 'satellite',
                    'type': 'raster',
                    'source': 'maplibre-satellite',
                    'layout': {
                        'visibility': 'none'
                    }
                }]
            }
        });

        // Suppress errors because we're not loading tiles from a real URL.
        map.on('error', () => {});

        await map.once('style.load');
        map.setLayoutProperty('satellite', 'visibility', 'visible');
        expect(map.getLayoutProperty('satellite', 'visibility')).toBe('visible');
    });

    test('sets visibility on video layer', async () => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'drone': {
                        'type': 'video',
                        'urls': [],
                        'coordinates': [
                            [-122.51596391201019, 37.56238816766053],
                            [-122.51467645168304, 37.56410183312965],
                            [-122.51309394836426, 37.563391708549425],
                            [-122.51423120498657, 37.56161849366671]
                        ]
                    }
                },
                'layers': [{
                    'id': 'shore',
                    'type': 'raster',
                    'source': 'drone',
                    'layout': {
                        'visibility': 'none'
                    }
                }]
            }
        });

        await map.once('style.load');
        map.setLayoutProperty('shore', 'visibility', 'visible');
        expect(map.getLayoutProperty('shore', 'visibility')).toBe('visible');
    });

    test('sets visibility on image layer', async () => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {
                    'image': {
                        'type': 'image',
                        'url': '',
                        'coordinates': [
                            [-122.51596391201019, 37.56238816766053],
                            [-122.51467645168304, 37.56410183312965],
                            [-122.51309394836426, 37.563391708549425],
                            [-122.51423120498657, 37.56161849366671]
                        ]
                    }
                },
                'layers': [{
                    'id': 'image',
                    'type': 'raster',
                    'source': 'image',
                    'layout': {
                        'visibility': 'none'
                    }
                }]
            }
        });

        await map.once('style.load');
        map.setLayoutProperty('image', 'visibility', 'visible');
        expect(map.getLayoutProperty('image', 'visibility')).toBe('visible');
    });
});

describe('getLayoutProperty', () => {
    test('fires an error if layer not found', async () => {
        const map = createMap({
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });

        await map.once('style.load');
        const errorPromise = map.once('error');
        map.getLayoutProperty('non-existant', 'text-transform');
        const error = await errorPromise;
        expect(error.error.message).toMatch(/Cannot get style of non-existing layer "non-existant"./);
    });
});

describe('setPaintProperty', () => {
    test('sets property', async () => {
        const map = createMap({
            style: {
                'version': 8,
                'sources': {},
                'layers': [{
                    'id': 'background',
                    'type': 'background'
                }]
            }
        });

        await map.once('style.load');
        map.setPaintProperty('background', 'background-color', 'red');
        expect(map.getPaintProperty('background', 'background-color')).toBe('red');
    });

    test('#3373 paint property should be synchronized with an update', async () => {
        const colors = ['red', 'blue'];
        const map = createMap({
            style: {
                'version': 8,
                'sources': {},
                'layers': [{
                    'id': 'background',
                    'type': 'background',
                    'paint': {
                        'background-color': colors[0]
                    }
                }]
            }
        });

        await map.once('style.load');
        expect(map.getPaintProperty('background', 'background-color')).toBe(colors[0]);
        expect(map.getStyle().layers.filter(l => l.id === 'background')[0].paint['background-color']).toBe(colors[0]);
        // update property
        map.setPaintProperty('background', 'background-color', colors[1]);
        expect(map.getPaintProperty('background', 'background-color')).toBe(colors[1]);
        expect(map.getStyle().layers.filter(l => l.id === 'background')[0].paint['background-color']).toBe(colors[1]);
    });

    test('throw before loaded', () => {
        const map = createMap({
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });

        expect(() => {
            map.setPaintProperty('background', 'background-color', 'red');
        }).toThrow(Error);

    });

    test('fires an error if layer not found', async () => {
        const map = createMap({
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });

        await map.once('style.load');
        const errorPromise = map.once('error');
        map.setPaintProperty('non-existant', 'background-color', 'red');
        const error = await errorPromise;
        expect(error.error.message).toMatch(/Cannot style non-existing layer "non-existant"./);
    });
});
