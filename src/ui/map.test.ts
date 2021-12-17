import '../../stub_loader';
import {test} from '../../util/test';
import {extend} from '../../../rollup/build/tsc/src/util/util';
import Map from '../../../rollup/build/tsc/src/ui/map';
import {createMap} from '../../util';
import LngLat from '../../../rollup/build/tsc/src/geo/lng_lat';
import Tile from '../../../rollup/build/tsc/src/source/tile';
import {OverscaledTileID} from '../../../rollup/build/tsc/src/source/tile_id';
import {Event, ErrorEvent} from '../../../rollup/build/tsc/src/util/evented';
import simulate from '../../util/simulate_interaction';
import {fixedLngLat, fixedNum} from '../../util/fixed';

function createStyleSource() {
    return {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: []
        }
    };
}

test('Map', (t) => {
    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.clearFakeXMLHttpRequest();
        callback();
    });

    t.test('constructor', (t) => {
        const map = createMap(t, {interactive: true, style: null});
        expect(map.getContainer()).toBeTruthy();
        expect(map.getStyle()).toBe(undefined);
        expect(map.boxZoom.isEnabled()).toBeTruthy();
        expect(map.doubleClickZoom.isEnabled()).toBeTruthy();
        expect(map.dragPan.isEnabled()).toBeTruthy();
        expect(map.dragRotate.isEnabled()).toBeTruthy();
        expect(map.keyboard.isEnabled()).toBeTruthy();
        expect(map.scrollZoom.isEnabled()).toBeTruthy();
        expect(map.touchZoomRotate.isEnabled()).toBeTruthy();
        expect(() => {
            new Map({
                container: 'anElementIdWhichDoesNotExistInTheDocument'
            });
        }).toThrowError(
            new Error("Container 'anElementIdWhichDoesNotExistInTheDocument' not found")
        );
        t.end();
    });

    t.test('bad map-specific token breaks map', (t) => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'offsetWidth', {value: 512});
        Object.defineProperty(container, 'offsetHeight', {value: 512});
        createMap(t);
        //t.error();
        t.end();
    });

    t.test('initial bounds in constructor options', (t) => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'offsetWidth', {value: 512});
        Object.defineProperty(container, 'offsetHeight', {value: 512});

        const bounds = [[-133, 16], [-68, 50]];
        const map = createMap(t, {container, bounds});

        expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
        expect(fixedNum(map.getZoom(), 3)).toBe(2.113);

        t.end();
    });

    t.test('initial bounds options in constructor options', (t) => {
        const bounds = [[-133, 16], [-68, 50]];

        const map = (fitBoundsOptions) => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'offsetWidth', {value: 512});
            Object.defineProperty(container, 'offsetHeight', {value: 512});
            return createMap(t, {container, bounds, fitBoundsOptions});
        };

        const unpadded = map(undefined, false);
        const padded = map({padding: 100}, true);

        expect(unpadded.getZoom() > padded.getZoom()).toBeTruthy();

        t.end();
    });

    t.test('disables handlers', (t) => {
        t.test('disables all handlers', (t) => {
            const map = createMap(t, {interactive: false});

            expect(map.boxZoom.isEnabled()).toBeFalsy();
            expect(map.doubleClickZoom.isEnabled()).toBeFalsy();
            expect(map.dragPan.isEnabled()).toBeFalsy();
            expect(map.dragRotate.isEnabled()).toBeFalsy();
            expect(map.keyboard.isEnabled()).toBeFalsy();
            expect(map.scrollZoom.isEnabled()).toBeFalsy();
            expect(map.touchZoomRotate.isEnabled()).toBeFalsy();

            t.end();
        });

        const handlerNames = [
            'scrollZoom',
            'boxZoom',
            'dragRotate',
            'dragPan',
            'keyboard',
            'doubleClickZoom',
            'touchZoomRotate'
        ];
        handlerNames.forEach((handlerName) => {
            t.test(`disables "${handlerName}" handler`, (t) => {
                const options = {};
                options[handlerName] = false;
                const map = createMap(t, options);

                expect(map[handlerName].isEnabled()).toBeFalsy();

                t.end();
            });
        });

        t.end();
    });

    t.test('emits load event after a style is set', (t) => {
        const map = new Map({container: window.document.createElement('div')});

        map.on('load', fail);

        setTimeout(() => {
            map.off('load', fail);
            map.on('load', pass);
            map.setStyle(createStyle());
        }, 1);

        function fail() { expect(false).toBeTruthy(); }
        function pass() { t.end(); }
    });

    t.test('#setStyle', (t) => {
        t.test('returns self', (t) => {
            const map = new Map({container: window.document.createElement('div')});
            expect(map.setStyle({
                version: 8,
                sources: {},
                layers: []
            })).toBe(map);
            t.end();
        });

        t.test('sets up event forwarding', (t) => {
            createMap(t, {}, (error, map) => {
                expect(error).toBeFalsy();

                const events = [];
                function recordEvent(event) { events.push(event.type); }

                map.on('error', recordEvent);
                map.on('data', recordEvent);
                map.on('dataloading', recordEvent);

                map.style.fire(new Event('error'));
                map.style.fire(new Event('data'));
                map.style.fire(new Event('dataloading'));

                expect(events).toEqual([
                    'error',
                    'data',
                    'dataloading',
                ]);

                t.end();
            });
        });

        t.test('fires *data and *dataloading events', (t) => {
            createMap(t, {}, (error, map) => {
                expect(error).toBeFalsy();

                const events = [];
                function recordEvent(event) { events.push(event.type); }

                map.on('styledata', recordEvent);
                map.on('styledataloading', recordEvent);
                map.on('sourcedata', recordEvent);
                map.on('sourcedataloading', recordEvent);
                map.on('tiledata', recordEvent);
                map.on('tiledataloading', recordEvent);

                map.style.fire(new Event('data', {dataType: 'style'}));
                map.style.fire(new Event('dataloading', {dataType: 'style'}));
                map.style.fire(new Event('data', {dataType: 'source'}));
                map.style.fire(new Event('dataloading', {dataType: 'source'}));
                map.style.fire(new Event('data', {dataType: 'tile'}));
                map.style.fire(new Event('dataloading', {dataType: 'tile'}));

                expect(events).toEqual([
                    'styledata',
                    'styledataloading',
                    'sourcedata',
                    'sourcedataloading',
                    'tiledata',
                    'tiledataloading'
                ]);

                t.end();
            });
        });

        t.test('can be called more than once', (t) => {
            const map = createMap(t);

            map.setStyle({version: 8, sources: {}, layers: []}, {diff: false});
            map.setStyle({version: 8, sources: {}, layers: []}, {diff: false});

            t.end();
        });

        t.test('style transform overrides unmodified map transform', (t) => {
            const map = new Map({container: window.document.createElement('div')});
            map.transform.lngRange = [-120, 140];
            map.transform.latRange = [-60, 80];
            map.transform.resize(600, 400);
            expect(map.transform.zoom).toBe(0.6983039737971012);
            expect(map.transform.unmodified).toBeTruthy();
            map.setStyle(createStyle());
            map.on('style.load', () => {
                expect(fixedLngLat(map.transform.center)).toEqual(fixedLngLat({lng: -73.9749, lat: 40.7736}));
                expect(fixedNum(map.transform.zoom)).toBe(12.5);
                expect(fixedNum(map.transform.bearing)).toBe(29);
                expect(fixedNum(map.transform.pitch)).toBe(50);
                t.end();
            });
        });

        t.test('style transform does not override map transform modified via options', (t) => {
            const map = new Map({container: window.document.createElement('div'), zoom: 10, center: [-77.0186, 38.8888]});
            expect(map.transform.unmodified).toBeFalsy();
            map.setStyle(createStyle());
            map.on('style.load', () => {
                expect(fixedLngLat(map.transform.center)).toEqual(fixedLngLat({lng: -77.0186, lat: 38.8888}));
                expect(fixedNum(map.transform.zoom)).toBe(10);
                expect(fixedNum(map.transform.bearing)).toBe(0);
                expect(fixedNum(map.transform.pitch)).toBe(0);
                t.end();
            });
        });

        t.test('style transform does not override map transform modified via setters', (t) => {
            const map = new Map({container: window.document.createElement('div')});
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
                t.end();
            });
        });

        t.test('passing null removes style', (t) => {
            const map = createMap(t);
            const style = map.style;
            expect(style).toBeTruthy();
            t.spy(style, '_remove');
            map.setStyle(null);
            expect(style._remove.callCount).toBe(1);
            t.end();
        });

        t.end();
    });

    t.test('#setTransformRequest', (t) => {
        t.test('returns self', (t) => {
            const transformRequest = () => { };
            const map = new Map({container: window.document.createElement('div')});
            expect(map.setTransformRequest(transformRequest)).toBe(map);
            expect(map._requestManager._transformRequestFn).toBe(transformRequest);
            t.end();
        });

        t.test('can be called more than once', (t) => {
            const map = createMap(t);

            const transformRequest = () => { };
            map.setTransformRequest(transformRequest);
            map.setTransformRequest(transformRequest);

            t.end();
        });

        t.end();
    });

    t.test('#is_Loaded', (t) => {

        t.test('Map#isSourceLoaded', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});

            map.on('load', () => {
                map.on('data', (e) => {
                    if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                        expect(map.isSourceLoaded('geojson')).toBe(true);
                        t.end();
                    }
                });
                map.addSource('geojson', createStyleSource());
                expect(map.isSourceLoaded('geojson')).toBe(false);
            });
        });

        t.test('Map#isStyleLoaded', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});

            expect(map.isStyleLoaded()).toBe(false);
            map.on('load', () => {
                expect(map.isStyleLoaded()).toBe(true);
                t.end();
            });
        });

        t.test('Map#areTilesLoaded', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            expect(map.areTilesLoaded()).toBe(true);
            map.on('load', () => {
                const fakeTileId = new OverscaledTileID(0, 0, 0, 0, 0);
                map.addSource('geojson', createStyleSource());
                map.style.sourceCaches.geojson._tiles[fakeTileId.key] = new Tile(fakeTileId);
                expect(map.areTilesLoaded()).toBe(false);
                map.style.sourceCaches.geojson._tiles[fakeTileId.key].state = 'loaded';
                expect(map.areTilesLoaded()).toBe(true);
                t.end();
            });
        });
        t.end();
    });

    t.test('#getStyle', (t) => {
        t.test('returns the style', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});

            map.on('load', () => {
                expect(map.getStyle()).toEqual(style);
                t.end();
            });
        });

        t.test('returns the style with added sources', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});

            map.on('load', () => {
                map.addSource('geojson', createStyleSource());
                expect(map.getStyle()).toEqual(extend(createStyle(), {
                    sources: {geojson: createStyleSource()}
                }));
                t.end();
            });
        });

        t.test('fires an error on checking if non-existant source is loaded', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});

            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /There is no source with ID/);
                    t.end();
                });
                map.isSourceLoaded('geojson');
            });
        });

        t.test('returns the style with added layers', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            const layer = {
                id: 'background',
                type: 'background'
            };

            map.on('load', () => {
                map.addLayer(layer);
                expect(map.getStyle()).toEqual(extend(createStyle(), {
                    layers: [layer]
                }));
                t.end();
            });
        });

        t.test('a layer can be added even if a map is created without a style', (t) => {
            const map = createMap(t, {deleteStyle: true});
            const layer = {
                id: 'background',
                type: 'background'
            };
            map.addLayer(layer);
            t.end();
        });

        t.test('a source can be added even if a map is created without a style', (t) => {
            const map = createMap(t, {deleteStyle: true});
            const source = createStyleSource();
            map.addSource('fill', source);
            t.end();
        });

        t.test('returns the style with added source and layer', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            const source = createStyleSource();
            const layer = {
                id: 'fill',
                type: 'fill',
                source: 'fill'
            };

            map.on('load', () => {
                map.addSource('fill', source);
                map.addLayer(layer);
                expect(map.getStyle()).toEqual(extend(createStyle(), {
                    sources: {fill: source},
                    layers: [layer]
                }));
                t.end();
            });
        });

        t.test('creates a new Style if diff fails', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            t.stub(map.style, 'setState').callsFake(() => {
                throw new Error('Dummy error');
            });
            t.stub(console, 'warn');

            const previousStyle = map.style;
            map.setStyle(style);
            expect(map.style && map.style !== previousStyle).toBeTruthy();
            t.end();
        });

        t.test('creates a new Style if diff option is false', (t) => {
            const style = createStyle();
            const map = createMap(t, {style});
            t.stub(map.style, 'setState').callsFake(() => {
                t.fail();
            });

            const previousStyle = map.style;
            map.setStyle(style, {diff: false});
            expect(map.style && map.style !== previousStyle).toBeTruthy();
            t.end();
        });

        t.end();
    });

    t.test('#moveLayer', (t) => {
        const map = createMap(t, {
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

        map.once('render', () => {
            map.moveLayer('layerId1', 'layerId2');
            expect(map.getLayer('layerId1').id).toBe('layerId1');
            expect(map.getLayer('layerId2').id).toBe('layerId2');
            t.end();
        });
    });

    t.test('#getLayer', (t) => {
        const layer = {
            id: 'layerId',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
        };
        const map = createMap(t, {
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

        map.once('render', () => {
            const mapLayer = map.getLayer('layerId');
            expect(mapLayer.id).toBe(layer.id);
            expect(mapLayer.type).toBe(layer.type);
            expect(mapLayer.source).toBe(layer.source);
            t.end();
        });
    });

    t.test('#resize', (t) => {
        t.test('sets width and height from container clients', (t) => {
            const map = createMap(t),
                container = map.getContainer();

            Object.defineProperty(container, 'clientWidth', {value: 250});
            Object.defineProperty(container, 'clientHeight', {value: 250});
            map.resize();

            expect(map.transform.width).toBe(250);
            expect(map.transform.height).toBe(250);

            t.end();
        });

        t.test('fires movestart, move, resize, and moveend events', (t) => {
            const map = createMap(t),
                events = [];

            ['movestart', 'move', 'resize', 'moveend'].forEach((event) => {
                map.on(event, (e) => {
                    events.push(e.type);
                });
            });

            map.resize();
            expect(events).toEqual(['movestart', 'move', 'resize', 'moveend']);

            t.end();
        });

        t.test('listen to window resize event', (t) => {
            const original = global.addEventListener;
            global.addEventListener = function(type) {
                if (type === 'resize') {
                    //restore original function not to mess with other tests
                    global.addEventListener = original;

                    t.end();
                }
            };

            createMap(t);
        });

        t.test('do not resize if trackResize is false', (t) => {
            const map = createMap(t, {trackResize: false});

            t.spy(map, 'stop');
            t.spy(map, '_update');
            t.spy(map, 'resize');

            map._onWindowResize();

            expect(map.stop.called).toBeFalsy();
            expect(map._update.called).toBeFalsy();
            expect(map.resize.called).toBeFalsy();

            t.end();
        });

        t.test('do resize if trackResize is true (default)', (t) => {
            const map = createMap(t);

            t.spy(map, '_update');
            t.spy(map, 'resize');

            map._onWindowResize();

            expect(map._update.called).toBeTruthy();
            expect(map.resize.called).toBeTruthy();

            t.end();
        });

        t.end();
    });

    t.test('#getBounds', (t) => {
        const map = createMap(t, {zoom: 0});
        expect(parseFloat(map.getBounds().getCenter().lng.toFixed(10))).toEqual(0);
        expect(parseFloat(map.getBounds().getCenter().lat.toFixed(10))).toEqual(0);

        expect(toFixed(map.getBounds().toArray())).toEqual(toFixed([
            [ -70.31249999999976, -57.326521225216965 ],
            [ 70.31249999999977, 57.32652122521695 ] ]));

        t.test('rotated bounds', (t) => {
            const map = createMap(t, {zoom: 1, bearing: 45});
            expect(
                toFixed([[-49.718445552178764, -44.44541580601936], [49.7184455522, 44.445415806019355]])
            ).toEqual(toFixed(map.getBounds().toArray()));

            map.setBearing(135);
            expect(
                toFixed([[-49.718445552178764, -44.44541580601936], [49.7184455522, 44.445415806019355]])
            ).toEqual(toFixed(map.getBounds().toArray()));

            t.end();
        });

        t.end();

        function toFixed(bounds) {
            const n = 10;
            return [
                [normalizeFixed(bounds[0][0], n), normalizeFixed(bounds[0][1], n)],
                [normalizeFixed(bounds[1][0], n), normalizeFixed(bounds[1][1], n)]
            ];
        }

        function normalizeFixed(num, n) {
            // workaround for "-0.0000000000" ≠ "0.0000000000"
            return parseFloat(num.toFixed(n)).toFixed(n);
        }
    });

    t.test('#setMaxBounds', (t) => {
        t.test('constrains map bounds', (t) => {
            const map = createMap(t, {zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(
                toFixed([[-130.4297000000, 7.0136641176], [-61.5234400000, 60.2398142283]])
            ).toEqual(toFixed(map.getBounds().toArray()));
            t.end();
        });

        t.test('when no argument is passed, map bounds constraints are removed', (t) => {
            const map = createMap(t, {zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(
                toFixed([[-166.28906999999964, -27.6835270554], [-25.664070000000066, 73.8248206697]])
            ).toEqual(toFixed(map.setMaxBounds(null).setZoom(0).getBounds().toArray()));
            t.end();
        });

        t.test('should not zoom out farther than bounds', (t) => {
            const map = createMap(t);
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(map.setZoom(0).getZoom()).not.toBe(0);
            t.end();
        });

        t.test('throws on invalid bounds', (t) => {
            const map = createMap(t, {zoom:0});
            expect(() => {
                map.setMaxBounds([-130.4297, 50.0642], [-61.52344, 24.20688]);
            }).toThrowError(Error);
            expect(() => {
                map.setMaxBounds(-130.4297, 50.0642, -61.52344, 24.20688);
            }).toThrowError(Error);
            t.end();
        });

        function toFixed(bounds) {
            const n = 9;
            return [
                [bounds[0][0].toFixed(n), bounds[0][1].toFixed(n)],
                [bounds[1][0].toFixed(n), bounds[1][1].toFixed(n)]
            ];
        }

        t.end();
    });

    t.test('#getMaxBounds', (t) => {
        t.test('returns null when no bounds set', (t) => {
            const map = createMap(t, {zoom:0});
            expect(map.getMaxBounds()).toBe(null);
            t.end();
        });

        t.test('returns bounds', (t) => {
            const map = createMap(t, {zoom:0});
            const bounds = [[-130.4297, 50.0642], [-61.52344, 24.20688]];
            map.setMaxBounds(bounds);
            expect(map.getMaxBounds().toArray()).toEqual(bounds);
            t.end();
        });

        t.end();
    });

    t.test('#getRenderWorldCopies', (t) => {
        t.test('initially false', (t) => {
            const map = createMap(t, {renderWorldCopies: false});
            expect(map.getRenderWorldCopies()).toBe(false);
            t.end();
        });

        t.test('initially true', (t) => {
            const map = createMap(t, {renderWorldCopies: true});
            expect(map.getRenderWorldCopies()).toBe(true);
            t.end();
        });

        t.end();
    });

    t.test('#setRenderWorldCopies', (t) => {
        t.test('initially false', (t) => {
            const map = createMap(t, {renderWorldCopies: false});
            map.setRenderWorldCopies(true);
            expect(map.getRenderWorldCopies()).toBe(true);
            t.end();
        });

        t.test('initially true', (t) => {
            const map = createMap(t, {renderWorldCopies: true});
            map.setRenderWorldCopies(false);
            expect(map.getRenderWorldCopies()).toBe(false);
            t.end();
        });

        t.test('undefined', (t) => {
            const map = createMap(t, {renderWorldCopies: false});
            map.setRenderWorldCopies(undefined);
            expect(map.getRenderWorldCopies()).toBe(true);
            t.end();
        });

        t.test('null', (t) => {
            const map = createMap(t, {renderWorldCopies: true});
            map.setRenderWorldCopies(null);
            expect(map.getRenderWorldCopies()).toBe(false);
            t.end();
        });

        t.end();
    });

    t.test('#setMinZoom', (t) => {
        const map = createMap(t, {zoom:5});
        map.setMinZoom(3.5);
        map.setZoom(1);
        expect(map.getZoom()).toBe(3.5);
        t.end();
    });

    t.test('unset minZoom', (t) => {
        const map = createMap(t, {minZoom:5});
        map.setMinZoom(null);
        map.setZoom(1);
        expect(map.getZoom()).toBe(1);
        t.end();
    });

    t.test('#getMinZoom', (t) => {
        const map = createMap(t, {zoom: 0});
        expect(map.getMinZoom()).toBe(-2);
        map.setMinZoom(10);
        expect(map.getMinZoom()).toBe(10);
        t.end();
    });

    t.test('ignore minZooms over maxZoom', (t) => {
        const map = createMap(t, {zoom:2, maxZoom:5});
        expect(() => {
            map.setMinZoom(6);
        }).toThrow();
        map.setZoom(0);
        expect(map.getZoom()).toBe(0);
        t.end();
    });

    t.test('#setMaxZoom', (t) => {
        const map = createMap(t, {zoom:0});
        map.setMaxZoom(3.5);
        map.setZoom(4);
        expect(map.getZoom()).toBe(3.5);
        t.end();
    });

    t.test('unset maxZoom', (t) => {
        const map = createMap(t, {maxZoom:5});
        map.setMaxZoom(null);
        map.setZoom(6);
        expect(map.getZoom()).toBe(6);
        t.end();
    });

    t.test('#getMaxZoom', (t) => {
        const map = createMap(t, {zoom: 0});
        expect(map.getMaxZoom()).toBe(22);
        map.setMaxZoom(10);
        expect(map.getMaxZoom()).toBe(10);
        t.end();
    });

    t.test('ignore maxZooms over minZoom', (t) => {
        const map = createMap(t, {minZoom:5});
        expect(() => {
            map.setMaxZoom(4);
        }).toThrow();
        map.setZoom(5);
        expect(map.getZoom()).toBe(5);
        t.end();
    });

    t.test('throw on maxZoom smaller than minZoom at init', (t) => {
        expect(() => {
            createMap(t, {minZoom:10, maxZoom:5});
        }).toThrowError(new Error(`maxZoom must be greater than or equal to minZoom`));
        t.end();
    });

    t.test('throw on maxZoom smaller than minZoom at init with falsey maxZoom', (t) => {
        expect(() => {
            createMap(t, {minZoom:1, maxZoom:0});
        }).toThrowError(new Error(`maxZoom must be greater than or equal to minZoom`));
        t.end();
    });

    t.test('#setMinPitch', (t) => {
        const map = createMap(t, {pitch: 20});
        map.setMinPitch(10);
        map.setPitch(0);
        expect(map.getPitch()).toBe(10);
        t.end();
    });

    t.test('unset minPitch', (t) => {
        const map = createMap(t, {minPitch: 20});
        map.setMinPitch(null);
        map.setPitch(0);
        expect(map.getPitch()).toBe(0);
        t.end();
    });

    t.test('#getMinPitch', (t) => {
        const map = createMap(t, {pitch: 0});
        expect(map.getMinPitch()).toBe(0);
        map.setMinPitch(10);
        expect(map.getMinPitch()).toBe(10);
        t.end();
    });

    t.test('ignore minPitchs over maxPitch', (t) => {
        const map = createMap(t, {pitch: 0, maxPitch: 10});
        expect(() => {
            map.setMinPitch(20);
        }).toThrow();
        map.setPitch(0);
        expect(map.getPitch()).toBe(0);
        t.end();
    });

    t.test('#setMaxPitch', (t) => {
        const map = createMap(t, {pitch: 0});
        map.setMaxPitch(10);
        map.setPitch(20);
        expect(map.getPitch()).toBe(10);
        t.end();
    });

    t.test('unset maxPitch', (t) => {
        const map = createMap(t, {maxPitch:10});
        map.setMaxPitch(null);
        map.setPitch(20);
        expect(map.getPitch()).toBe(20);
        t.end();
    });

    t.test('#getMaxPitch', (t) => {
        const map = createMap(t, {pitch: 0});
        expect(map.getMaxPitch()).toBe(60);
        map.setMaxPitch(10);
        expect(map.getMaxPitch()).toBe(10);
        t.end();
    });

    t.test('ignore maxPitchs over minPitch', (t) => {
        const map = createMap(t, {minPitch:10});
        expect(() => {
            map.setMaxPitch(0);
        }).toThrow();
        map.setPitch(10);
        expect(map.getPitch()).toBe(10);
        t.end();
    });

    t.test('throw on maxPitch smaller than minPitch at init', (t) => {
        expect(() => {
            createMap(t, {minPitch: 10, maxPitch: 5});
        }).toThrowError(new Error(`maxPitch must be greater than or equal to minPitch`));
        t.end();
    });

    t.test('throw on maxPitch smaller than minPitch at init with falsey maxPitch', (t) => {
        expect(() => {
            createMap(t, {minPitch: 1, maxPitch: 0});
        }).toThrowError(new Error(`maxPitch must be greater than or equal to minPitch`));
        t.end();
    });

    t.test('throw on maxPitch greater than valid maxPitch at init', (t) => {
        expect(() => {
            createMap(t, {maxPitch: 90});
        }).toThrowError(new Error(`maxPitch must be less than or equal to 85`));
        t.end();
    });

    t.test('throw on minPitch less than valid minPitch at init', (t) => {
        expect(() => {
            createMap(t, {minPitch: -10});
        }).toThrowError(new Error(`minPitch must be greater than or equal to 0`));
        t.end();
    });

    t.test('#remove', (t) => {
        const map = createMap(t);
        expect(map.getContainer().childNodes.length).toBe(2);
        map.remove();
        expect(map.getContainer().childNodes.length).toBe(0);
        t.end();
    });

    t.test('#remove calls onRemove on added controls', (t) => {
        const map = createMap(t);
        const control = {
            onRemove: t.spy(),
            onAdd (_) {
                return window.document.createElement('div');
            }
        };
        map.addControl(control);
        map.remove();
        expect(control.onRemove.calledOnce).toBeTruthy();
        t.end();
    });

    t.test('#remove calls onRemove on added controls before style is destroyed', (t) => {
        const map = createMap(t);
        let onRemoveCalled = 0;
        let style;
        const control = {
            onRemove(map) {
                onRemoveCalled++;
                expect(map.getStyle()).toEqual(style);
            },
            onAdd (_) {
                return window.document.createElement('div');
            }
        };

        map.addControl(control);

        map.on('style.load', () => {
            style = map.getStyle();
            map.remove();
            expect(onRemoveCalled).toBe(1);
            t.end();
        });
    });

    t.test('does not fire "webglcontextlost" after #remove has been called', (t) => {
        const map = createMap(t);
        const canvas = map.getCanvas();
        map.once('webglcontextlost', () => t.fail('"webglcontextlost" fired after #remove has been called'));
        map.remove();
        // Dispatch the event manually because at the time of this writing, gl does not support
        // the WEBGL_lose_context extension.
        canvas.dispatchEvent(new window.Event('webglcontextlost'));
        t.end();
    });

    t.test('does not fire "webglcontextrestored" after #remove has been called', (t) => {
        const map = createMap(t);
        const canvas = map.getCanvas();

        map.once('webglcontextlost', () => {
            map.once('webglcontextrestored', () => t.fail('"webglcontextrestored" fired after #remove has been called'));
            map.remove();
            canvas.dispatchEvent(new window.Event('webglcontextrestored'));
            t.end();
        });

        // Dispatch the event manually because at the time of this writing, gl does not support
        // the WEBGL_lose_context extension.
        canvas.dispatchEvent(new window.Event('webglcontextlost'));
    });

    t.test('#redraw', (t) => {
        const map = createMap(t);

        map.once('idle', () => {
            map.once('render', () => t.end());

            map.redraw();
        });
    });

    t.test('#addControl', (t) => {
        const map = createMap(t);
        const control = {
            onAdd(_) {
                expect(map).toBe(_);
                return window.document.createElement('div');
            }
        };
        map.addControl(control);
        expect(map._controls[1]).toBe(control);
        t.end();
    });

    t.test('#removeControl errors on invalid arguments', (t) => {
        const map = createMap(t);
        const control = {};
        const stub = t.stub(console, 'error');

        map.addControl(control);
        map.removeControl(control);
        expect(stub.calledTwice).toBeTruthy();
        t.end();

    });

    t.test('#removeControl', (t) => {
        const map = createMap(t);
        const control = {
            onAdd() {
                return window.document.createElement('div');
            },
            onRemove(_) {
                expect(map).toBe(_);
            }
        };
        map.addControl(control);
        map.removeControl(control);
        expect(map._controls.length).toBe(1);
        t.end();

    });

    t.test('#hasControl', (t) => {
        const map = createMap(t);
        function Ctrl() {}
        Ctrl.prototype = {
            onAdd(_) {
                return window.document.createElement('div');
            }
        };

        const control = new Ctrl();
        expect(map.hasControl(control)).toBe(false);
        map.addControl(control);
        expect(map.hasControl(control)).toBe(true);
        t.end();
    });

    t.test('#project', (t) => {
        const map = createMap(t);
        expect(map.project([0, 0])).toEqual({x: 100, y: 100});
        t.end();
    });

    t.test('#unproject', (t) => {
        const map = createMap(t);
        expect(fixedLngLat(map.unproject([100, 100]))).toEqual({lng: 0, lat: 0});
        t.end();
    });

    t.test('#listImages', (t) => {
        const map = createMap(t);

        map.on('load', () => {
            expect(map.listImages().length).toBe(0);

            map.addImage('img', {width: 1, height: 1, data: new Uint8Array(4)});

            const images = map.listImages();
            expect(images.length).toBe(1);
            expect(images[0]).toBe('img');
            t.end();
        });
    });

    t.test('#listImages throws an error if called before "load"', (t) => {
        const map = createMap(t);
        expect(() => {
            map.listImages();
        }).toThrowError(Error);
        t.end();
    });

    t.test('#queryRenderedFeatures', (t) => {

        t.test('if no arguments provided', (t) => {
            createMap(t, {}, (err, map) => {
                expect(err).toBeFalsy();
                t.spy(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures();

                const args = map.style.queryRenderedFeatures.getCall(0).args;
                expect(args[0]).toBeTruthy();
                expect(args[1]).toEqual({availableImages: []});
                expect(output).toEqual([]);

                t.end();
            });
        });

        t.test('if only "geometry" provided', (t) => {
            createMap(t, {}, (err, map) => {
                expect(err).toBeFalsy();
                t.spy(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures(map.project(new LngLat(0, 0)));

                const args = map.style.queryRenderedFeatures.getCall(0).args;
                expect(args[0]).toEqual([{x: 100, y: 100}]); // query geometry
                expect(args[1]).toEqual({availableImages: []}); // params
                expect(args[2]).toEqual(map.transform); // transform
                expect(output).toEqual([]);

                t.end();
            });
        });

        t.test('if only "params" provided', (t) => {
            createMap(t, {}, (err, map) => {
                expect(err).toBeFalsy();
                t.spy(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures({filter: ['all']});

                const args = map.style.queryRenderedFeatures.getCall(0).args;
                expect(args[0]).toBeTruthy();
                expect(args[1]).toEqual({availableImages: [], filter: ['all']});
                expect(output).toEqual([]);

                t.end();
            });
        });

        t.test('if both "geometry" and "params" provided', (t) => {
            createMap(t, {}, (err, map) => {
                expect(err).toBeFalsy();
                t.spy(map.style, 'queryRenderedFeatures');

                const output = map.queryRenderedFeatures({filter: ['all']});

                const args = map.style.queryRenderedFeatures.getCall(0).args;
                expect(args[0]).toBeTruthy();
                expect(args[1]).toEqual({availableImages: [], filter: ['all']});
                expect(output).toEqual([]);

                t.end();
            });
        });

        t.test('if "geometry" with unwrapped coords provided', (t) => {
            createMap(t, {}, (err, map) => {
                expect(err).toBeFalsy();
                t.spy(map.style, 'queryRenderedFeatures');

                map.queryRenderedFeatures(map.project(new LngLat(360, 0)));

                expect(map.style.queryRenderedFeatures.getCall(0).args[0]).toEqual([{x: 612, y: 100}]);
                t.end();
            });
        });

        t.test('returns an empty array when no style is loaded', (t) => {
            const map = createMap(t, {style: undefined});
            expect(map.queryRenderedFeatures()).toEqual([]);
            t.end();
        });

        t.end();
    });

    t.test('#setLayoutProperty', (t) => {
        t.test('sets property', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": {
                            "type": "geojson",
                            "data": {
                                "type": "FeatureCollection",
                                "features": []
                            }
                        }
                    },
                    "layers": [{
                        "id": "symbol",
                        "type": "symbol",
                        "source": "geojson",
                        "layout": {
                            "text-transform": "uppercase"
                        }
                    }]
                }
            });

            map.on('style.load', () => {
                map.style.dispatcher.broadcast = function(key, value) {
                    expect(key).toBe('updateLayers');
                    expect(value.layers.map((layer) => { return layer.id; })).toEqual(['symbol']);
                };

                map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
                map.style.update({});
                expect(map.getLayoutProperty('symbol', 'text-transform')).toEqual('lowercase');
                t.end();
            });
        });

        t.test('throw before loaded', (t) => {
            const map = createMap(t, {
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            expect(() => {
                map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
            }).toThrowError(Error);

            t.end();
        });

        t.test('fires an error if layer not found', (t) => {
            const map = createMap(t, {
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map.on('style.load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /Cannot style non-existing layer "non-existant"./);
                    t.end();
                });
                map.setLayoutProperty('non-existant', 'text-transform', 'lowercase');
            });
        });

        t.test('fires a data event', (t) => {
            // background layers do not have a source
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "background",
                        "type": "background",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            map.once('style.load', () => {
                map.once('data', (e) => {
                    if (e.dataType === 'style') {
                        t.end();
                    }
                });

                map.setLayoutProperty('background', 'visibility', 'visible');
            });
        });

        t.test('sets visibility on background layer', (t) => {
            // background layers do not have a source
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "background",
                        "type": "background",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            map.on('style.load', () => {
                map.setLayoutProperty('background', 'visibility', 'visible');
                expect(map.getLayoutProperty('background', 'visibility')).toEqual('visible');
                t.end();
            });
        });

        t.test('sets visibility on raster layer', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "mapbox://mapbox.satellite": {
                            "type": "raster",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": [{
                        "id": "satellite",
                        "type": "raster",
                        "source": "mapbox://mapbox.satellite",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            // Suppress errors because we're not loading tiles from a real URL.
            map.on('error', () => {});

            map.on('style.load', () => {
                map.setLayoutProperty('satellite', 'visibility', 'visible');
                expect(map.getLayoutProperty('satellite', 'visibility')).toEqual('visible');
                t.end();
            });
        });

        t.test('sets visibility on video layer', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "drone": {
                            "type": "video",
                            "urls": [],
                            "coordinates": [
                                [-122.51596391201019, 37.56238816766053],
                                [-122.51467645168304, 37.56410183312965],
                                [-122.51309394836426, 37.563391708549425],
                                [-122.51423120498657, 37.56161849366671]
                            ]
                        }
                    },
                    "layers": [{
                        "id": "shore",
                        "type": "raster",
                        "source": "drone",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            map.on('style.load', () => {
                map.setLayoutProperty('shore', 'visibility', 'visible');
                expect(map.getLayoutProperty('shore', 'visibility')).toEqual('visible');
                t.end();
            });
        });

        t.test('sets visibility on image layer', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "image": {
                            "type": "image",
                            "url": "",
                            "coordinates": [
                                [-122.51596391201019, 37.56238816766053],
                                [-122.51467645168304, 37.56410183312965],
                                [-122.51309394836426, 37.563391708549425],
                                [-122.51423120498657, 37.56161849366671]
                            ]
                        }
                    },
                    "layers": [{
                        "id": "image",
                        "type": "raster",
                        "source": "image",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            map.on('style.load', () => {
                map.setLayoutProperty('image', 'visibility', 'visible');
                expect(map.getLayoutProperty('image', 'visibility')).toEqual('visible');
                t.end();
            });
        });

        t.end();
    });

    t.test('#getLayoutProperty', (t) => {
        t.test('fires an error if layer not found', (t) => {
            const map = createMap(t, {
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map.on('style.load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /Cannot get style of non-existing layer "non-existant"./);
                    t.end();
                });
                map.getLayoutProperty('non-existant', 'text-transform', 'lowercase');
            });
        });

        t.end();
    });

    t.test('#setPaintProperty', (t) => {
        t.test('sets property', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "background",
                        "type": "background"
                    }]
                }
            });

            map.on('style.load', () => {
                map.setPaintProperty('background', 'background-color', 'red');
                expect(map.getPaintProperty('background', 'background-color')).toEqual('red');
                t.end();
            });
        });

        t.test('throw before loaded', (t) => {
            const map = createMap(t, {
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            expect(() => {
                map.setPaintProperty('background', 'background-color', 'red');
            }).toThrowError(Error);

            t.end();
        });

        t.test('fires an error if layer not found', (t) => {
            const map = createMap(t, {
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            map.on('style.load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /Cannot style non-existing layer "non-existant"./);
                    t.end();
                });
                map.setPaintProperty('non-existant', 'background-color', 'red');
            });
        });

        t.end();
    });

    t.test('#setFeatureState', (t) => {
        t.test('sets state', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
                const fState = map.getFeatureState({source: 'geojson', id: 12345});
                expect(fState.hover).toBe(true);
                t.end();
            });
        });
        t.test('works with string ids', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 'foo'}, {'hover': true});
                const fState = map.getFeatureState({source: 'geojson', id: 'foo'});
                expect(fState.hover).toBe(true);
                t.end();
            });
        });
        t.test('parses feature id as an int', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: '12345'}, {'hover': true});
                const fState = map.getFeatureState({source: 'geojson', id: 12345});
                expect(fState.hover).toBe(true);
                t.end();
            });
        });
        t.test('throw before loaded', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            expect(() => {
                map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            }).toThrowError(Error);

            t.end();
        });
        t.test('fires an error if source not found', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /source/);
                    t.end();
                });
                map.setFeatureState({source: 'vector', id: 12345}, {'hover': true});
            });
        });
        t.test('fires an error if sourceLayer not provided for a vector source', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "vector": {
                            "type": "vector",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /sourceLayer/);
                    t.end();
                });
                map.setFeatureState({source: 'vector', sourceLayer: 0, id: 12345}, {'hover': true});
            });
        });
        t.test('fires an error if id not provided', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "vector": {
                            "type": "vector",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /id/);
                    t.end();
                });
                map.setFeatureState({source: 'vector', sourceLayer: "1"}, {'hover': true});
            });
        });
        t.end();
    });

    t.test('#removeFeatureState', (t) => {

        t.test('accepts "0" id', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 0}, {'hover': true, 'click': true});
                map.removeFeatureState({source: 'geojson', id: 0}, 'hover');
                const fState = map.getFeatureState({source: 'geojson', id: 0});
                expect(fState.hover).toBe(undefined);
                expect(fState.click).toBe(true);
                t.end();
            });
        });
        t.test('accepts string id', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 'foo'}, {'hover': true, 'click': true});
                map.removeFeatureState({source: 'geojson', id: 'foo'}, 'hover');
                const fState = map.getFeatureState({source: 'geojson', id: 'foo'});
                expect(fState.hover).toBe(undefined);
                expect(fState.click).toBe(true);
                t.end();
            });
        });
        t.test('remove specific state property', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});
                map.removeFeatureState({source: 'geojson', id: 12345}, 'hover');
                const fState = map.getFeatureState({source: 'geojson', id: 12345});
                expect(fState.hover).toBe(undefined);
                t.end();
            });
        });
        t.test('remove all state properties of one feature', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
                map.removeFeatureState({source: 'geojson', id: 1});

                const fState = map.getFeatureState({source: 'geojson', id: 1});
                expect(fState.hover).toBe(undefined);
                expect(fState.foo).toBe(undefined);

                t.end();
            });
        });
        t.test('remove properties for zero-based feature IDs.', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 0}, {'hover': true, 'foo': true});
                map.removeFeatureState({source: 'geojson', id: 0});

                const fState = map.getFeatureState({source: 'geojson', id: 0});
                expect(fState.hover).toBe(undefined);
                expect(fState.foo).toBe(undefined);

                t.end();
            });
        });
        t.test('other properties persist when removing specific property', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
                map.removeFeatureState({source: 'geojson', id: 1}, 'hover');

                const fState = map.getFeatureState({source: 'geojson', id: 1});
                expect(fState.foo).toBe(true);

                t.end();
            });
        });
        t.test('remove all state properties of all features in source', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
                map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});

                map.removeFeatureState({source: 'geojson'});

                const fState1 = map.getFeatureState({source: 'geojson', id: 1});
                expect(fState1.hover).toBe(undefined);
                expect(fState1.foo).toBe(undefined);

                const fState2 = map.getFeatureState({source: 'geojson', id: 2});
                expect(fState2.hover).toBe(undefined);
                expect(fState2.foo).toBe(undefined);

                t.end();
            });
        });
        t.test('specific state deletion should not interfere with broader state deletion', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
                map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});

                map.removeFeatureState({source: 'geojson', id: 1});
                map.removeFeatureState({source: 'geojson', id: 1}, 'foo');

                const fState1 = map.getFeatureState({source: 'geojson', id: 1});
                expect(fState1.hover).toBe(undefined);

                map.setFeatureState({source: 'geojson', id: 1}, {'hover': true, 'foo': true});
                map.removeFeatureState({source: 'geojson'});
                map.removeFeatureState({source: 'geojson', id: 1}, 'foo');

                const fState2 = map.getFeatureState({source: 'geojson', id: 2});
                expect(fState2.hover).toBe(undefined);

                map.setFeatureState({source: 'geojson', id: 2}, {'hover': true, 'foo': true});
                map.removeFeatureState({source: 'geojson'});
                map.removeFeatureState({source: 'geojson', id: 2}, 'foo');

                const fState3 = map.getFeatureState({source: 'geojson', id: 2});
                expect(fState3.hover).toBe(undefined);

                t.end();
            });
        });
        t.test('add/remove and remove/add state', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});

                map.removeFeatureState({source: 'geojson', id: 12345});
                map.setFeatureState({source: 'geojson', id: 12345}, {'hover': true});

                const fState1 = map.getFeatureState({source: 'geojson', id: 12345});
                expect(fState1.hover).toBe(true);

                map.removeFeatureState({source: 'geojson', id: 12345});

                const fState2 = map.getFeatureState({source: 'geojson', id: 12345});
                expect(fState2.hover).toBe(undefined);

                t.end();
            });
        });
        t.test('throw before loaded', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            expect(() => {
                map.removeFeatureState({source: 'geojson', id: 12345}, {'hover': true});
            }).toThrowError(Error);

            t.end();
        });
        t.test('fires an error if source not found', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": createStyleSource()
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /source/);
                    t.end();
                });
                map.removeFeatureState({source: 'vector', id: 12345}, {'hover': true});
            });
        });
        t.test('fires an error if sourceLayer not provided for a vector source', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "vector": {
                            "type": "vector",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /sourceLayer/);
                    t.end();
                });
                map.removeFeatureState({source: 'vector', sourceLayer: 0, id: 12345}, {'hover': true});
            });
        });
        t.test('fires an error if state property is provided without a feature id', (t) => {
            const map = createMap(t, {
                style: {
                    "version": 8,
                    "sources": {
                        "vector": {
                            "type": "vector",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": []
                }
            });
            map.on('load', () => {
                map.on('error', ({error}) => {
                    t.match(error.message, /id/);
                    t.end();
                });
                map.removeFeatureState({source: 'vector', sourceLayer: "1"}, {'hover': true});
            });
        });
        t.end();
    });

    t.test('error event', (t) => {
        t.test('logs errors to console when it has NO listeners', (t) => {
            const map = createMap(t);
            const stub = t.stub(console, 'error');
            const error = new Error('test');
            map.fire(new ErrorEvent(error));
            expect(stub.calledOnce).toBeTruthy();
            expect(stub.getCall(0).args[0]).toBe(error);
            t.end();
        });

        t.test('calls listeners', (t) => {
            const map = createMap(t);
            const error = new Error('test');
            map.on('error', (event) => {
                expect(event.error).toBe(error);
                t.end();
            });
            map.fire(new ErrorEvent(error));
        });

        t.end();
    });

    t.test('render stabilizes', (t) => {
        const style = createStyle();
        style.sources.mapbox = {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            tiles: ['http://example.com/{z}/{x}/{y}.png']
        };
        style.layers.push({
            id: 'layerId',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
        });

        let timer;
        const map = createMap(t, {style});
        map.on('render', () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                map.off('render');
                map.on('render', t.fail);
                expect(map._frameId).toBeFalsy();
                t.end();
            }, 100);
        });
    });

    t.test('no render after idle event', (t) => {
        const style = createStyle();
        const map = createMap(t, {style});
        map.on('idle', () => {
            map.on('render', t.fail);
            setTimeout(() => {
                t.end();
            }, 100);
        });
    });

    t.test('no idle event during move', (t) => {
        const style = createStyle();
        const map = createMap(t, {style, fadeDuration: 0});
        map.once('idle', () => {
            map.zoomTo(0.5, {duration: 100});
            expect(map.isMoving()).toBeTruthy();
            map.once('idle', () => {
                expect(!map.isMoving()).toBeTruthy();
                t.end();
            });
        });
    });

    t.test('#removeLayer restores Map#loaded() to true', (t) => {
        const map = createMap(t, {
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

        map.once('render', () => {
            map.removeLayer('layerId');
            map.on('render', () => {
                if (map.loaded()) {
                    map.remove();
                    t.end();
                }
            });
        });
    });

    t.test('stops camera animation on mousedown when interactive', (t) => {
        const map = createMap(t, {interactive: true});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.mousedown(map.getCanvasContainer());
        expect(map.isEasing()).toBe(false);

        map.remove();
        t.end();
    });

    t.test('continues camera animation on mousedown when non-interactive', (t) => {
        const map = createMap(t, {interactive: false});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.mousedown(map.getCanvasContainer());
        expect(map.isEasing()).toBe(true);

        map.remove();
        t.end();
    });

    t.test('stops camera animation on touchstart when interactive', (t) => {
        const map = createMap(t, {interactive: true});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.touchstart(map.getCanvasContainer(), {touches: [{target: map.getCanvas(), clientX: 0, clientY: 0}]});
        expect(map.isEasing()).toBe(false);

        map.remove();
        t.end();
    });

    t.test('continues camera animation on touchstart when non-interactive', (t) => {
        const map = createMap(t, {interactive: false});
        map.flyTo({center: [200, 0], duration: 100});

        simulate.touchstart(map.getCanvasContainer());
        expect(map.isEasing()).toBe(true);

        map.remove();
        t.end();
    });

    t.test('continues camera animation on resize', (t) => {
        const map = createMap(t),
            container = map.getContainer();

        map.flyTo({center: [200, 0], duration: 100});

        Object.defineProperty(container, 'clientWidth', {value: 250});
        Object.defineProperty(container, 'clientHeight', {value: 250});
        map.resize();

        expect(map.isMoving()).toBeTruthy();

        t.end();
    });

    t.test('map fires `styleimagemissing` for missing icons', (t) => {
        const map = createMap(t);

        const id = "missing-image";

        let called;
        map.on('styleimagemissing', e => {
            map.addImage(e.id, {width: 1, height: 1, data: new Uint8Array(4)});
            called = e.id;
        });

        expect(map.hasImage(id)).toBeFalsy();

        map.style.imageManager.getImages([id], () => {
            expect(called).toBe(id);
            expect(map.hasImage(id)).toBeTruthy();
            t.end();
        });
    });

    t.test('map does not fire `styleimagemissing` for empty icon values', (t) => {
        const map = createMap(t);

        map.on('load', () => {
            map.on('idle', () => {
                t.end();
            });

            map.addSource('foo', {
                type: 'geojson',
                data: {type: 'Point', coordinates: [0, 0]}
            });
            map.addLayer({
                id: 'foo',
                type: 'symbol',
                source: 'foo',
                layout: {
                    'icon-image': ['case', true, '', '']
                }
            });

            map.on('styleimagemissing', ({id}) => {
                t.fail(`styleimagemissing fired for value ${id}`);
            });
        });
    });

    t.end();
});

function createStyle() {
    return {
        version: 8,
        center: [-73.9749, 40.7736],
        zoom: 12.5,
        bearing: 29,
        pitch: 50,
        sources: {},
        layers: []
    };
}
