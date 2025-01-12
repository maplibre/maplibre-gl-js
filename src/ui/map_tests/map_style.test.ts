import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {Map, type MapOptions} from '../map';
import {createMap, beforeMapTest, createStyle, createStyleSource} from '../../util/test/util';
import {Event as EventedEvent} from '../../util/evented';
import {fixedLngLat, fixedNum} from '../../../test/unit/lib/fixed';
import {extend} from '../../util/util';
import {fakeServer, type FakeServer} from 'nise';
import {Style} from '../../style/style';
import {type GeoJSONSourceSpecification, type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {LngLatBounds} from '../../geo/lng_lat_bounds';

let server: FakeServer;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});

describe('#setStyle', () => {
    test('returns self', () => {
        const map = new Map({container: window.document.createElement('div')} as any as MapOptions);
        expect(map.setStyle({
            version: 8,
            sources: {},
            layers: []
        })).toBe(map);
    });

    test('sets up event forwarding', () => {
        createMap({}, (error, map) => {
            expect(error).toBeFalsy();

            const events = [];
            function recordEvent(event) { events.push(event.type); }

            map.on('error', recordEvent);
            map.on('data', recordEvent);
            map.on('dataloading', recordEvent);

            map.style.fire(new EventedEvent('error'));
            map.style.fire(new EventedEvent('data'));
            map.style.fire(new EventedEvent('dataloading'));

            expect(events).toEqual([
                'error',
                'data',
                'dataloading',
            ]);

        });
    });

    test('fires *data and *dataloading events', () => {
        createMap({}, (error, map: Map) => {
            expect(error).toBeFalsy();

            const events = [];
            function recordEvent(event) { events.push(event.type); }

            map.on('styledata', recordEvent);
            map.on('styledataloading', recordEvent);
            map.on('sourcedata', recordEvent);
            map.on('sourcedataloading', recordEvent);
            map.on('tiledata', recordEvent);
            map.on('tiledataloading', recordEvent);

            map.style.fire(new EventedEvent('data', {dataType: 'style'}));
            map.style.fire(new EventedEvent('dataloading', {dataType: 'style'}));
            map.style.fire(new EventedEvent('data', {dataType: 'source'}));
            map.style.fire(new EventedEvent('dataloading', {dataType: 'source'}));
            map.style.fire(new EventedEvent('data', {dataType: 'tile'}));
            map.style.fire(new EventedEvent('dataloading', {dataType: 'tile'}));

            expect(events).toEqual([
                'styledata',
                'styledataloading',
                'sourcedata',
                'sourcedataloading',
                'tiledata',
                'tiledataloading'
            ]);

        });
    });

    test('can be called more than once', () => {
        const map = createMap();

        map.setStyle({version: 8, sources: {}, layers: []}, {diff: false});
        map.setStyle({version: 8, sources: {}, layers: []}, {diff: false});

    });

    test('setStyle back to the first style should work', async () => {
        const redStyle = {version: 8 as const, sources: {}, layers: [
            {id: 'background', type: 'background' as const, paint: {'background-color': 'red'}},
        ]};
        const blueStyle = {version: 8 as const, sources: {}, layers: [
            {id: 'background', type: 'background' as const, paint: {'background-color': 'blue'}},
        ]};
        const map = createMap({style: redStyle});
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        map.setStyle(blueStyle);
        await map.once('style.load');
        map.setStyle(redStyle);
        const serializedStyle =  map.style.serialize();
        expect(serializedStyle.layers[0].paint['background-color']).toBe('red');
        spy.mockRestore();
    });

    test('style transform overrides unmodified map transform', () => new Promise<void>(done => {
        const map = new Map({container: window.document.createElement('div')} as any as MapOptions);
        map.transform.setMaxBounds(new LngLatBounds([-120, -60], [140, 80]));
        map.transform.resize(600, 400, true);
        expect(map.transform.zoom).toBe(0.6983039737971013);
        expect(map.transform.unmodified).toBeTruthy();
        map.setStyle(createStyle());
        map.on('style.load', () => {
            expect(fixedLngLat(map.transform.center)).toEqual(fixedLngLat({lng: -73.9749, lat: 40.7736}));
            expect(fixedNum(map.transform.zoom)).toBe(12.5);
            expect(fixedNum(map.transform.bearing)).toBe(29);
            expect(fixedNum(map.transform.pitch)).toBe(50);
            done();
        });
    }));

    test('style transform does not override map transform modified via options', () => new Promise<void>(done => {
        const map = new Map({container: window.document.createElement('div'), zoom: 10, center: [-77.0186, 38.8888]} as any as MapOptions);
        expect(map.transform.unmodified).toBeFalsy();
        map.setStyle(createStyle());
        map.on('style.load', () => {
            expect(fixedLngLat(map.transform.center)).toEqual(fixedLngLat({lng: -77.0186, lat: 38.8888}));
            expect(fixedNum(map.transform.zoom)).toBe(10);
            expect(fixedNum(map.transform.bearing)).toBe(0);
            expect(fixedNum(map.transform.pitch)).toBe(0);
            done();
        });
    }));

    test('style transform does not override map transform modified via setters', () => new Promise<void>(done => {
        const map = new Map({container: window.document.createElement('div')} as any as MapOptions);
        expect(map.transform.unmodified).toBeTruthy();
        map.setZoom(10);
        map.setCenter([-77.0186, 38.8888]);
        expect(map.transform.unmodified).toBeFalsy();
        map.setStyle(createStyle());
        map.on('style.load', () => {
            expect(fixedLngLat(map.transform.center)).toEqual(fixedLngLat({lng: -77.0186, lat: 38.8888}));
            expect(fixedNum(map.transform.zoom)).toBe(10);
            expect(fixedNum(map.transform.bearing)).toBe(0);
            expect(fixedNum(map.transform.pitch)).toBe(0);
            done();
        });
    }));

    test('passing null removes style', () => {
        const map = createMap();
        const style = map.style;
        expect(style).toBeTruthy();
        vi.spyOn(style, '_remove');
        map.setStyle(null);
        expect(style._remove).toHaveBeenCalledTimes(1);
    });

    test('passing null releases the worker', () => {
        const map = createMap();
        const spyWorkerPoolAcquire = vi.spyOn(map.style.dispatcher.workerPool, 'acquire');
        const spyWorkerPoolRelease = vi.spyOn(map.style.dispatcher.workerPool, 'release');

        map.setStyle({version: 8, sources: {}, layers: []}, {diff: false});
        expect(spyWorkerPoolAcquire).toHaveBeenCalledTimes(1);
        expect(spyWorkerPoolRelease).toHaveBeenCalledTimes(0);

        spyWorkerPoolAcquire.mockClear();
        map.setStyle(null);
        expect(spyWorkerPoolAcquire).toHaveBeenCalledTimes(0);
        expect(spyWorkerPoolRelease).toHaveBeenCalledTimes(1);

        // Cleanup
        spyWorkerPoolAcquire.mockClear();
        spyWorkerPoolRelease.mockClear();
    });

    test('transformStyle should copy the source and the layer into next style', () => new Promise<void>(done => {
        const style = extend(createStyle(), {
            sources: {
                maplibre: {
                    type: 'vector',
                    minzoom: 1,
                    maxzoom: 10,
                    tiles: ['http://example.com/{z}/{x}/{y}.png']
                }
            },
            layers: [{
                id: 'layerId0',
                type: 'circle',
                source: 'maplibre',
                'source-layer': 'sourceLayer'
            }, {
                id: 'layerId1',
                type: 'circle',
                source: 'maplibre',
                'source-layer': 'sourceLayer'
            }]
        });

        const map = createMap({style});
        map.setStyle(createStyle(), {
            diff: false,
            transformStyle: (prevStyle, nextStyle) => ({
                ...nextStyle,
                sources: {
                    ...nextStyle.sources,
                    maplibre: prevStyle.sources.maplibre
                },
                layers: [
                    ...nextStyle.layers,
                    prevStyle.layers[0]
                ]
            })
        });

        map.on('style.load', () => {
            const loadedStyle = map.style.serialize();
            expect('maplibre' in loadedStyle.sources).toBeTruthy();
            expect(loadedStyle.layers[0].id).toBe(style.layers[0].id);
            expect(loadedStyle.layers).toHaveLength(1);
            done();
        });
    }));

    test('delayed setStyle with transformStyle should copy the source and the layer into next style with diffing', () => new Promise<void>(done => {
        const style = extend(createStyle(), {
            sources: {
                maplibre: {
                    type: 'vector',
                    minzoom: 1,
                    maxzoom: 10,
                    tiles: ['http://example.com/{z}/{x}/{y}.png']
                }
            },
            layers: [{
                id: 'layerId0',
                type: 'circle',
                source: 'maplibre',
                'source-layer': 'sourceLayer'
            }, {
                id: 'layerId1',
                type: 'circle',
                source: 'maplibre',
                'source-layer': 'sourceLayer'
            }]
        });

        const map = createMap({style});
        window.setTimeout(() => {
            map.setStyle(createStyle(), {
                diff: true,
                transformStyle: (prevStyle, nextStyle) => ({
                    ...nextStyle,
                    sources: {
                        ...nextStyle.sources,
                        maplibre: prevStyle.sources.maplibre
                    },
                    layers: [
                        ...nextStyle.layers,
                        prevStyle.layers[0]
                    ]
                })
            });

            const loadedStyle = map.style.serialize();
            expect('maplibre' in loadedStyle.sources).toBeTruthy();
            expect(loadedStyle.layers[0].id).toBe(style.layers[0].id);
            expect(loadedStyle.layers).toHaveLength(1);
            done();
        }, 100);
    }));

    test('transformStyle should get called when passed to setStyle after the map is initialised without a style', () => new Promise<void>(done => {
        const map = createMap({deleteStyle: true});
        map.setStyle(createStyle(), {
            diff: true,
            transformStyle: (prevStyle, nextStyle) => {
                expect(prevStyle).toBeUndefined();

                return {
                    ...nextStyle,
                    sources: {
                        maplibre: {
                            type: 'vector',
                            minzoom: 1,
                            maxzoom: 10,
                            tiles: ['http://example.com/{z}/{x}/{y}.png']
                        }
                    },
                    layers: [{
                        id: 'layerId0',
                        type: 'circle',
                        source: 'maplibre',
                        'source-layer': 'sourceLayer'
                    }]
                };
            }
        });

        map.on('style.load', () => {
            const loadedStyle = map.style.serialize();
            expect('maplibre' in loadedStyle.sources).toBeTruthy();
            expect(loadedStyle.layers[0].id).toBe('layerId0');
            done();
        });
    }));

    test('map load should be fired when transformStyle is used on setStyle after the map is initialised without a style', () => new Promise<void>(done => {
        const map = createMap({deleteStyle: true});
        map.setStyle({version: 8, sources: {}, layers: []}, {
            diff: true,
            transformStyle: (prevStyle, nextStyle) => {
                expect(prevStyle).toBeUndefined();
                expect(nextStyle).toBeDefined();
                return createStyle();
            }
        });
        map.on('load', () => done());
    }));

    test('Override default style validation', () => {
        let validationOption = true;
        vi.spyOn(Style.prototype, 'loadJSON').mockImplementationOnce((styleJson, options) => {
            validationOption = options.validate;
        });
        const map = createMap({style: null});
        map.setStyle({version: 8, sources: {}, layers: []}, {validate: false});

        expect(validationOption).toBeFalsy();
    });
});

describe('#getStyle', () => {
    test('returns undefined if the style has not loaded yet', () => {
        const style = createStyle();
        const map = createMap({style});
        expect(map.getStyle()).toBeUndefined();
    });

    test('returns the style', () => new Promise<void>(done => {
        const style = createStyle();
        const map = createMap({style});

        map.on('load', () => {
            expect(map.getStyle()).toEqual(style);
            done();
        });
    }));

    test('returns the previous style even if modified', async () => {
        const style = {
            version: 8 as const,
            sources: {},
            layers: [
                {
                    id: 'background',
                    type: 'background' as const,
                    paint: {'background-color': 'blue'}
                },
            ]
        };

        const map = createMap({style});

        await map.once('load');
        const newStyle = map.getStyle();
        newStyle.layers[0].paint = {'background-color': 'red'};

        // map.getStyle() should still equal the original style since
        // we have not yet called map.setStyle(...).
        expect(map.getStyle()).toEqual(style);
    });

    test('returns the style with added sources', () => new Promise<void>(done => {
        const style = createStyle();
        const map = createMap({style});

        map.on('load', () => {
            map.addSource('geojson', createStyleSource());
            expect(map.getStyle()).toEqual(extend(createStyle(), {
                sources: {geojson: createStyleSource()}
            }));
            done();
        });
    }));

    test('fires an error on checking if non-existant source is loaded', () => new Promise<void>(done => {
        const style = createStyle();
        const map = createMap({style});

        map.on('load', () => {
            map.on('error', ({error}) => {
                expect(error.message).toMatch(/There is no source with ID/);
                done();
            });
            map.isSourceLoaded('geojson');
        });
    }));

    test('returns the style with added layers', () => new Promise<void>(done => {
        const style = createStyle();
        const map = createMap({style});
        const layer = {
            id: 'background',
            type: 'background'
        } as LayerSpecification;

        map.on('load', () => {
            map.addLayer(layer);
            expect(map.getStyle()).toEqual(extend(createStyle(), {
                layers: [layer]
            }));
            done();
        });
    }));

    test('a layer can be added even if a map is created without a style', () => {
        const map = createMap({deleteStyle: true});
        const layer = {
            id: 'background',
            type: 'background'
        } as LayerSpecification;
        map.addLayer(layer);
    });

    test('a source can be added even if a map is created without a style', () => {
        const map = createMap({deleteStyle: true});
        const source = createStyleSource();
        map.addSource('fill', source);
    });

    test('a layer can be added with an embedded source specification', () => {
        const map = createMap({deleteStyle: true});
        const source: GeoJSONSourceSpecification = {
            type: 'geojson',
            data: {type: 'Point', coordinates: [0, 0]}
        };
        map.addLayer({
            id: 'foo',
            type: 'symbol',
            source
        });
    });

    test('returns the style with added source and layer', () => new Promise<void>(done => {
        const style = createStyle();
        const map = createMap({style});
        const source = createStyleSource();
        const layer = {
            id: 'fill',
            type: 'fill',
            source: 'fill'
        } as LayerSpecification;

        map.on('load', () => {
            map.addSource('fill', source);
            map.addLayer(layer);
            expect(map.getStyle()).toEqual(extend(createStyle(), {
                sources: {fill: source},
                layers: [layer]
            }));
            done();
        });
    }));

    test('creates a new Style if diff fails', () => {
        const style = createStyle();
        const map = createMap({style});
        vi.spyOn(map.style, 'setState').mockImplementation(() => {
            throw new Error('Dummy error');
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const previousStyle = map.style;
        map.setStyle(style);
        expect(map.style && map.style !== previousStyle).toBeTruthy();
    });

    test('creates a new Style if diff option is false', () => {
        const style = createStyle();
        const map = createMap({style});
        const spy = vi.spyOn(map.style, 'setState');

        const previousStyle = map.style;
        map.setStyle(style, {diff: false});
        expect(map.style && map.style !== previousStyle).toBeTruthy();
        expect(spy).not.toHaveBeenCalled();
    });

    describe('#setSky', () => {
        test('calls style setSky when set', () => {
            const map = createMap();
            const spy = vi.fn();
            map.style.setSky = spy;
            map.setSky({'horizon-fog-blend': 0.5});

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('#getSky', () => {
        test('returns undefined when not set', () => {
            const map = createMap();
            expect(map.getSky()).toBeUndefined();
        });
    });

    describe('#setLight', () => {
        test('calls style setLight when set', () => {
            const map = createMap();
            const spy = vi.fn();
            map.style.setLight = spy;
            map.setLight({anchor: 'viewport'});

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('#getLight', () => {
        test('calls style getLight when invoked', () => {
            const map = createMap();
            const spy = vi.fn();
            map.style.getLight = spy;
            map.getLight();

            expect(spy).toHaveBeenCalled();
        });
    });

});
