import {describe, beforeEach, test, expect, vi} from 'vitest';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {type StyleLayer} from '../../style/style_layer';
import {createMap, beforeMapTest, createStyle, sleep, createTerrain} from '../../util/test/util';
import {type MapGeoJSONFeature} from '../../util/vectortile_to_geojson';
import {type MapLayerEventType, type MapLibreEvent} from '../events';
import {Map, type MapOptions} from '../map';
import {Event as EventedEvent, ErrorEvent} from '../../util/evented';
import {GlobeProjection} from '../../geo/projection/globe_projection';
import {type StyleSpecification} from '@maplibre/maplibre-gl-style-spec';

type IsAny<T> = 0 extends T & 1 ? T : never;
type NotAny<T> = T extends IsAny<T> ? never : T;
function assertNotAny<T>(_x: NotAny<T>) { }

beforeEach(() => {
    beforeMapTest();
});

describe('map events', () => {

    test('Map.on adds a non-delegated event listener', () => {
        const map = createMap();
        const spy = vi.fn(function (e) {
            expect(this).toBe(map);
            expect(e.type).toBe('click');
        });

        map.on('click', spy);
        simulate.click(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map.off removes a non-delegated event listener', () => {
        const map = createMap();
        const spy = vi.fn();

        map.on('click', spy);
        map.off('click', spy);
        simulate.click(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();

    });

    test('Map.on adds a listener for an event on a given layer', () => {
        const map = createMap();
        const features = [{} as MapGeoJSONFeature];

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((_point, options) => {
            expect(options).toEqual({layers: ['layer']});
            return features;
        });

        const spy = vi.fn(function (e) {
            expect(this).toBe(map);
            expect(e.type).toBe('click');
            expect(e.features).toBe(features);
        });

        map.on('click', 'layer', spy);
        simulate.click(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map.on adds a listener for an event on multiple layers', () => {
        const map = createMap();
        const features = [{} as MapGeoJSONFeature];

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures')
            .mockImplementationOnce((_point, options) => {
                expect(options).toEqual({layers: ['layer1', 'layer2']});
                return features;
            });

        const spy = vi.fn((e) => {
            expect(e.type).toBe('click');
            expect(e.features).toBe(features);
        });
        map.on('click', ['layer1', 'layer2'], spy);
        simulate.click(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map.on adds a listener for an event on multiple layers and allows to unsubscribe', () => {
        const map = createMap();
        const features = [{} as MapGeoJSONFeature];

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures')
            .mockImplementationOnce((_point, options) => {
                expect(options).toEqual({layers: ['layer1', 'layer2']});
                return features;
            });

        const spy = vi.fn();

        const subscription = map.on('click', ['layer1', 'layer2'], spy);
        subscription.unsubscribe();
        simulate.click(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });

    test('Map.on adds listener which calls queryRenderedFeatures only for existing layers', () => {
        const map = createMap();
        const features = [{} as MapGeoJSONFeature];

        vi.spyOn(map, 'getLayer').mockImplementation((id: string) => {
            if (id === 'nonExistingLayer') {
                return undefined;
            }
            return {} as StyleLayer;
        });
        vi.spyOn(map, 'queryRenderedFeatures')
            .mockImplementationOnce((_point, options) => {
                expect(options).toEqual({layers: ['layer1', 'layer2']});
                return features;
            });

        const spy = vi.fn(function (e) {
            expect(this).toBe(map);
            expect(e.type).toBe('click');
            expect(e.features).toBe(features);
        });

        map.on('click', ['layer1', 'layer2', 'nonExistingLayer'], spy);
        simulate.click(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map.on adds a listener not triggered for events not matching any features', () => {
        const map = createMap();
        const features = [];

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            expect(options).toEqual({layers: ['layer']});
            return features;
        });

        const spy = vi.fn();

        map.on('click', 'layer', spy);
        simulate.click(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();

    });

    test('Map.on adds a listener not triggered when the specified layer does not exist', () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockReturnValue(null as unknown as StyleLayer);

        const spy = vi.fn();

        map.on('click', 'layer', spy);
        simulate.click(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();

    });

    test('Map.on distinguishes distinct event types', () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

        const spyDown = vi.fn((e) => {
            expect(e.type).toBe('mousedown');
        });

        const spyUp = vi.fn((e) => {
            expect(e.type).toBe('mouseup');
        });

        map.on('mousedown', 'layer', spyDown);
        map.on('mouseup', 'layer', spyUp);
        simulate.click(map.getCanvas());

        expect(spyDown).toHaveBeenCalledTimes(1);
        expect(spyUp).toHaveBeenCalledTimes(1);
    });

    test('Map.on distinguishes distinct layers', () => {
        const map = createMap();
        const featuresA = [{} as MapGeoJSONFeature];
        const featuresB = [{} as MapGeoJSONFeature];

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((_point, options) => {
            return (options as any).layers[0] === 'A' ? featuresA : featuresB;
        });

        const spyA = vi.fn((e) => {
            expect(e.features).toBe(featuresA);
        });

        const spyB = vi.fn((e) => {
            expect(e.features).toBe(featuresB);
        });

        map.on('click', 'A', spyA);
        map.on('click', 'B', spyB);
        simulate.click(map.getCanvas());

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).toHaveBeenCalledTimes(1);
    });

    test('Map.on distinguishes distinct listeners', () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

        const spyA = vi.fn();
        const spyB = vi.fn();

        map.on('click', 'layer', spyA);
        map.on('click', 'layer', spyB);
        simulate.click(map.getCanvas());

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).toHaveBeenCalledTimes(1);
    });

    test('Map.on calls an event listener with no type arguments, defaulting to \'unknown\' originalEvent type', () => {
        const map = createMap();

        const handler = {
            onMove: function onMove(_event: MapLibreEvent) {}
        };

        vi.spyOn(handler, 'onMove');

        map.on('move', (event) => handler.onMove(event));
        map.jumpTo({center: {lng: 10, lat: 10}});

        expect(handler.onMove).toHaveBeenCalledTimes(1);
    });

    test('Map.on allows a listener to infer the event type ', () => {
        const map = createMap();

        const spy = vi.fn();
        map.on('mousemove', (event) => {
            assertNotAny(event);
            const {lng, lat} = event.lngLat;
            spy({lng, lat});
        });

        simulate.mousemove(map.getCanvas());
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map.off removes a delegated event listener', () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

        const spy = vi.fn();

        map.on('click', 'layer', spy);
        map.off('click', 'layer', spy);
        simulate.click(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });

    test('Map.off removes a delegated event listener for multiple layers', () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

        const spy = vi.fn();

        map.on('click', ['layer1', 'layer2'], spy);
        map.off('click', ['layer1', 'layer2'], spy);
        simulate.click(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });

    test('Map.off distinguishes distinct event types', () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

        const spy = vi.fn((e) => {
            expect(e.type).toBe('mousedown');
        });

        map.on('mousedown', 'layer', spy);
        map.on('mouseup', 'layer', spy);
        map.off('mouseup', 'layer', spy);
        simulate.click(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map.off distinguishes distinct layers', () => {
        const map = createMap();
        const featuresA = [{} as MapGeoJSONFeature];

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            expect(options).toEqual({layers: ['A']});
            return featuresA;
        });

        const spy = vi.fn((e) => {
            expect(e.features).toBe(featuresA);
        });

        map.on('click', 'A', spy);
        map.on('click', 'B', spy);
        map.off('click', 'B', spy);
        simulate.click(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map.off distinguishes distinct layer arrays', () => {
        const map = createMap();
        const featuresAB = [{} as MapGeoJSONFeature];

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            expect(options).toEqual({layers: ['A', 'B']});
            return featuresAB;
        });

        const spy = vi.fn((e) => {
            expect(e.features).toBe(featuresAB);
        });

        map.on('click', ['A', 'B'], spy);
        map.on('click', ['A', 'C'], spy);
        map.off('click', ['A', 'C'], spy);
        simulate.click(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map.off compares full layer array list, including layers missing in style', () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation((id: string) => {
            if (id === 'nonExistingLayer') {
                return undefined;
            }
            return {} as StyleLayer;
        });
        vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

        const spy = vi.fn();

        map.on('click', ['A', 'C', 'nonExistingLayer'], spy);
        map.off('click', ['A', 'C'], spy);

        simulate.click(map.getCanvas());

        map.off('click', ['A', 'C', 'nonExistingLayer'], spy);

        simulate.click(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map.off distinguishes distinct listeners', () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

        const spyA = vi.fn();
        const spyB = vi.fn();

        map.on('click', 'layer', spyA);
        map.on('click', 'layer', spyB);
        map.off('click', 'layer', spyB);
        simulate.click(map.getCanvas());

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).not.toHaveBeenCalled();
    });

    test('Map.off calls an event listener with no type arguments, defaulting to \'unknown\' originalEvent type', () => {
        const map = createMap();

        const handler = {
            onMove: function onMove(_event: MapLibreEvent) {}
        };

        vi.spyOn(handler, 'onMove');

        map.off('move', (event) => handler.onMove(event));
        map.jumpTo({center: {lng: 10, lat: 10}});

        expect(handler.onMove).toHaveBeenCalledTimes(0);
    });

    test('Map.off allows a listener to infer the event type ', () => {
        const map = createMap();

        const spy = vi.fn();
        map.off('mousemove', (event) => {
            assertNotAny(event);
            const {lng, lat} = event.lngLat;
            spy({lng, lat});
        });

        simulate.mousemove(map.getCanvas());
        expect(spy).toHaveBeenCalledTimes(0);
    });

    test('Map.once calls an event listener with no type arguments, defaulting to \'unknown\' originalEvent type', () => {
        const map = createMap();

        const handler = {
            onMoveOnce: function onMoveOnce(_event: MapLibreEvent) {}
        };

        vi.spyOn(handler, 'onMoveOnce');

        map.once('move', (event) => handler.onMoveOnce(event));
        map.jumpTo({center: {lng: 10, lat: 10}});

        expect(handler.onMoveOnce).toHaveBeenCalledTimes(1);
    });

    test('Map.once allows a listener to infer the event type ', () => {
        const map = createMap();

        const spy = vi.fn();
        map.once('mousemove', (event) => {
            assertNotAny(event);
            const {lng, lat} = event.lngLat;
            spy({lng, lat});
        });

        simulate.mousemove(map.getCanvas());
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map.off removes listener registered with Map.once', () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

        const spy = vi.fn();

        map.once('click', 'layer', spy);
        map.off('click', 'layer', spy);
        simulate.click(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });

    (['mouseenter', 'mouseover'] as (keyof MapLayerEventType)[]).forEach((event) => {
        test(`Map.on ${event} does not fire if the specified layer does not exist`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockReturnValue(null as unknown as StyleLayer);

            const spy = vi.fn();

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).not.toHaveBeenCalled();

        });

        test(`Map.on ${event} fires when entering the specified layer`, () => {
            const map = createMap();
            const features = [{} as MapGeoJSONFeature];

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((_point, options) => {
                expect(options).toEqual({layers: ['layer']});
                return features;
            });

            const spy = vi.fn(function (e) {
                expect(this).toBe(map);
                expect(e.type).toBe(event);
                expect(e.target).toBe(map);
                expect(e.features).toBe(features);
            });

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test(`Map.on ${event} does not fire on mousemove within the specified layer`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

            const spy = vi.fn();

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test(`Map.on ${event} fires when reentering the specified layer`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures')
                .mockReturnValueOnce([{} as MapGeoJSONFeature])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([{} as MapGeoJSONFeature]);

            const spy = vi.fn();

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(2);
        });

        test(`Map.on ${event} fires when reentering the specified layer after leaving the canvas`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

            const spy = vi.fn();

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mouseout(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(2);
        });

        test(`Map.on ${event} distinguishes distinct layers`, () => {
            const map = createMap();
            const featuresA = [{} as MapGeoJSONFeature];
            const featuresB = [{} as MapGeoJSONFeature];

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((_point, options) => {
                return (options as any).layers[0] === 'A' ? featuresA : featuresB;
            });

            const spyA = vi.fn((e) => {
                expect(e.features).toBe(featuresA);
            });

            const spyB = vi.fn((e) => {
                expect(e.features).toBe(featuresB);
            });

            map.on(event, 'A', spyA);
            map.on(event, 'B', spyB);

            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spyA).toHaveBeenCalledTimes(1);
            expect(spyB).toHaveBeenCalledTimes(1);
        });

        test(`Map.on ${event} distinguishes distinct layers when multiple layers provided`, () => {
            const map = createMap();

            const nonEmptyFeatures = [{} as MapGeoJSONFeature];
            const emptyFeatures = [];

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((_point, options) => {
                const layers = (options as any).layers as string[];
                if (layers.includes('A')) {
                    return nonEmptyFeatures;
                }
                return emptyFeatures;
            });

            const spyA = vi.fn();
            const spyAB = vi.fn();
            const spyC = vi.fn();

            map.on(event, 'A', spyA);
            map.on(event, ['A', 'B'], spyAB);
            map.on(event, 'C', spyC);

            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spyA).toHaveBeenCalledTimes(1);
            expect(spyAB).toHaveBeenCalledTimes(1);
            expect(spyC).not.toHaveBeenCalled();
        });

        test(`Map.on ${event} filters non-existing layers`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockImplementation((id: string) => id === 'B' ? undefined : {} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((_point, options) => {
                expect((options as any).layers).toStrictEqual(['A', 'C']);
                return [{} as MapGeoJSONFeature];
            });

            const spyAC = vi.fn();

            map.on(event, ['A', 'B', 'C'], spyAC);

            simulate.mousemove(map.getCanvas());

            expect(map.queryRenderedFeatures).toHaveBeenCalled();
            expect(spyAC).toHaveBeenCalledTimes(1);
        });

        test(`Map.on ${event} distinguishes distinct listeners`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

            const spyA = vi.fn();
            const spyB = vi.fn();

            map.on(event, 'layer', spyA);
            map.on(event, 'layer', spyB);
            simulate.mousemove(map.getCanvas());

            expect(spyA).toHaveBeenCalledTimes(1);
            expect(spyB).toHaveBeenCalledTimes(1);
        });

        test(`Map.off ${event} removes a delegated event listener`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

            const spy = vi.fn();

            map.on(event, 'layer', spy);
            map.off(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());

            expect(spy).not.toHaveBeenCalled();

        });

        test(`Map.off ${event} distinguishes distinct layers`, () => {
            const map = createMap();
            const featuresA = [{} as MapGeoJSONFeature];

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((_point, options) => {
                expect(options).toEqual({layers: ['A']});
                return featuresA;
            });

            const spy = vi.fn((e) => {
                expect(e.features).toBe(featuresA);
            });

            map.on(event, 'A', spy);
            map.on(event, 'B', spy);
            map.off(event, 'B', spy);
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test(`Map.off ${event} distinguishes distinct layers when multiple layers provided`, () => {
            const map = createMap();
            const featuresAB = [{} as MapGeoJSONFeature];

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((_point, options) => {
                expect(options).toEqual({layers: ['A', 'B']});
                return featuresAB;
            });

            const spy = vi.fn((e) => {
                expect(e.features).toBe(featuresAB);
            });

            map.on(event, ['A', 'B'], spy);
            map.on(event, ['B', 'C'], spy);
            map.off(event, ['B', 'C'], spy);
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(1);
            expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(1);
        });

        test(`Map.off ${event} distinguishes distinct listeners`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

            const spyA = vi.fn();
            const spyB = vi.fn();

            map.on(event, 'layer', spyA);
            map.on(event, 'layer', spyB);
            map.off(event, 'layer', spyB);
            simulate.mousemove(map.getCanvas());

            expect(spyA).toHaveBeenCalledTimes(1);
            expect(spyB).not.toHaveBeenCalled();
        });
    });

    (['mouseleave', 'mouseout'] as (keyof MapLayerEventType)[]).forEach((event) => {
        test(`Map.on ${event} does not fire if the specified layer does not exist`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockReturnValue(undefined);
            vi.spyOn(map, 'queryRenderedFeatures');

            const spy = vi.fn();

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).not.toHaveBeenCalled();
            expect(map.queryRenderedFeatures).not.toHaveBeenCalled();
        });

        test(`Map.on ${event} fires if one of specified layers exists`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockImplementation((id: string) => id === 'A' ? {} as StyleLayer : undefined);
            vi.spyOn(map, 'queryRenderedFeatures')
                .mockReturnValueOnce([{} as MapGeoJSONFeature])
                .mockReturnValueOnce([]);

            const spy = vi.fn();

            map.on(event, ['A', 'B'], spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test(`Map.on ${event} does not fire on mousemove when entering or within the specified layer`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

            const spy = vi.fn();

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).not.toHaveBeenCalled();

        });

        test(`Map.on ${event} fires when exiting the specified layer`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures')
                .mockReturnValueOnce([{} as MapGeoJSONFeature])
                .mockReturnValueOnce([]);

            const spy = vi.fn(function (e) {
                expect(this).toBe(map);
                expect(e.type).toBe(event);
                expect(e.features).toBeUndefined();
            });

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test(`Map.on ${event} fires when exiting the canvas`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{} as MapGeoJSONFeature]);

            const spy = vi.fn(function (e) {
                expect(this).toBe(map);
                expect(e.type).toBe(event);
                expect(e.features).toBeUndefined();
            });

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mouseout(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test(`Map.off ${event} removes a delegated event listener`, () => {
            const map = createMap();

            vi.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            vi.spyOn(map, 'queryRenderedFeatures')
                .mockReturnValueOnce([{} as MapGeoJSONFeature])
                .mockReturnValueOnce([]);

            const spy = vi.fn();

            map.on(event, 'layer', spy);
            map.off(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());
            simulate.mouseout(map.getCanvas());

            expect(spy).not.toHaveBeenCalled();

        });
    });

    test('Map.on mousedown can have default behavior prevented and still fire subsequent click event', () => {
        const map = createMap();

        map.on('mousedown', e => e.preventDefault());

        const click = vi.fn();
        map.on('click', click);

        simulate.click(map.getCanvas());
        expect(click).toHaveBeenCalled();

        map.remove();
    });

    test('Map.on mousedown doesn\'t fire subsequent click event if mousepos changes', () => {
        const map = createMap();

        map.on('mousedown', e => e.preventDefault());

        const click = vi.fn();
        map.on('click', click);
        const canvas = map.getCanvas();

        simulate.drag(canvas, {}, {clientX: 100, clientY: 100});
        expect(click).not.toHaveBeenCalled();

        map.remove();
    });

    test('Map.on mousedown fires subsequent click event if mouse position changes less than click tolerance', () => {
        const map = createMap({clickTolerance: 4});

        map.on('mousedown', e => e.preventDefault());

        const click = vi.fn();
        map.on('click', click);
        const canvas = map.getCanvas();

        simulate.drag(canvas, {clientX: 100, clientY: 100}, {clientX: 100, clientY: 103});
        expect(click).toHaveBeenCalled();

        map.remove();
    });

    test('Map.on mousedown does not fire subsequent click event if mouse position changes more than click tolerance', () => {
        const map = createMap({clickTolerance: 4});

        map.on('mousedown', e => e.preventDefault());

        const click = vi.fn();
        map.on('click', click);
        const canvas = map.getCanvas();

        simulate.drag(canvas, {clientX: 100, clientY: 100}, {clientX: 100, clientY: 104});
        expect(click).not.toHaveBeenCalled();

        map.remove();
    });

    test('Map.on click fires subsequent click event if there is no corresponding mousedown/mouseup event', () => {
        const map = createMap({clickTolerance: 4});

        const click = vi.fn();
        map.on('click', click);
        const canvas = map.getCanvas();

        const event = new MouseEvent('click', {bubbles: true, clientX: 100, clientY: 100});
        canvas.dispatchEvent(event);
        expect(click).toHaveBeenCalled();

        map.remove();
    });

    test('Map.isMoving() returns false in mousedown/mouseup/click with no movement', () => {
        const map = createMap({interactive: true, clickTolerance: 4});
        let mousedown, mouseup, click;
        map.on('mousedown', () => { mousedown = map.isMoving(); });
        map.on('mouseup', () => { mouseup = map.isMoving(); });
        map.on('click', () => { click = map.isMoving(); });

        const canvas = map.getCanvas();

        canvas.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 100, clientY: 100}));
        expect(mousedown).toBe(false);
        map._renderTaskQueue.run();
        expect(mousedown).toBe(false);

        canvas.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: 100, clientY: 100}));
        expect(mouseup).toBe(false);
        map._renderTaskQueue.run();
        expect(mouseup).toBe(false);

        canvas.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: 100, clientY: 100}));
        expect(click).toBe(false);
        map._renderTaskQueue.run();
        expect(click).toBe(false);

        map.remove();
    });

    test('emits load event after a style is set', async () => {
        const map = new Map({container: window.document.createElement('div')} as any as MapOptions);

        const failSpy = vi.fn();

        map.on('load', failSpy);
        await sleep(1);
        map.off('load', failSpy);
        const promise = map.once('load');
        map.setStyle(createStyle());

        await promise;
        expect(failSpy).not.toHaveBeenCalled();
    });

    test('errors inside load event are not suppressed', async () => {
        const map = new Map({container: window.document.createElement('div')} as any as MapOptions);

        const loadHandler = vi.fn(() => {
            throw new Error('Error in load handler');
        });

        map.on('load', loadHandler);
        await sleep(1);

        expect(loadHandler).toThrowError();
    });

    test('no idle event during move', async () => {
        const style = createStyle();
        const map = createMap({style, fadeDuration: 0});
        await map.once('idle');
        map.zoomTo(0.5, {duration: 100});
        expect(map.isMoving()).toBeTruthy();
        await map.once('idle');
        expect(map.isMoving()).toBeFalsy();
    });

    test('fires sourcedataabort event on dataabort event', async () => {
        const map = createMap();
        const sourcePromise = map.once('sourcedataabort');
        map.fire(new EventedEvent('dataabort'));
        await sourcePromise;
    });

    test('getZoom on moveend is the same as after the map end moving, with terrain on', async () => {
        const map = createMap({interactive: true, clickTolerance: 4});
        await map.once('style.load');
        map.terrain = createTerrain();
        let actualZoom: number;
        map.on('moveend', () => {
            // this can't use a promise due to race condition
            actualZoom = map.getZoom();
        });
        const canvas = map.getCanvas();
        simulate.dragWithMove(canvas, {x: 100, y: 100}, {x: 100, y: 150});
        map._renderTaskQueue.run();

        expect(actualZoom).toBe(map.getZoom());
    });

    test('drag from center', () => {
        const map = createMap({interactive: true, clickTolerance: 4});
        map.on('moveend', () => {
            expect(map.getCenter().lng).toBeCloseTo(0, 10);
            expect(map.getCenter().lat).toBeCloseTo(33.13755119234696, 10);
            expect(map.getCenterElevation()).toBeCloseTo(0, 10);
        });
        const canvas = map.getCanvas();
        simulate.dragWithMove(canvas, {x: 100, y: 100}, {x: 100, y: 150});
        map._renderTaskQueue.run();
    });

    test('drag from off center', () => {
        const map = createMap({interactive: true, clickTolerance: 4});
        map.on('moveend', () => {
            expect(map.getCenter().lng).toBeCloseTo(0, 10);
            expect(map.getCenter().lat).toBeCloseTo(33.13755119234696, 10);
            expect(map.getCenterElevation()).toBeCloseTo(0, 10);
        });
        const canvas = map.getCanvas();
        simulate.dragWithMove(canvas, {x: 50, y: 50}, {x: 50, y: 100});
        map._renderTaskQueue.run();
    });

    describe('error event', () => {
        test('logs errors to console when it has NO listeners', () => {
            // to avoid seeing error in the console in Jest
            let stub = vi.spyOn(console, 'error').mockImplementation(() => {});
            const map = createMap();
            stub.mockReset();
            stub = vi.spyOn(console, 'error').mockImplementation(() => {});
            const error = new Error('test');
            map.fire(new ErrorEvent(error));
            expect(stub).toHaveBeenCalledTimes(1);
            expect(stub.mock.calls[0][0]).toBe(error);
        });

        test('calls listeners', async () => {
            const map = createMap();
            const error = new Error('test');
            const promise = map.once('error');
            map.fire(new ErrorEvent(error));
            const event = await promise;
            expect(event.error).toBe(error);
        });

        test('does not call listeners after unsubscribe', async () => {
            const map = createMap();
            const error = new Error('test');
            const spy = vi.fn();
            const subscription = map.on('error', spy);
            subscription.unsubscribe();
            map.fire(new ErrorEvent(error));
            expect(spy).not.toHaveBeenCalled();
        });

        test('throws error when request fails', async () => {
            const style: StyleSpecification = {
                ...createStyle(),
                sources: {
                    'source': {
                        type: 'vector',
                        url: 'maplibre://nonexistent'
                    }
                },
                layers: [
                    {
                        id: 'layer',
                        source: 'source',
                        type: 'fill',
                        'source-layer': 'test'
                    }
                ]
            };
            const map = createMap();
            map.setStyle(style);

            const errorHandler = vi.fn();
            map.on('error', errorHandler);

            map.triggerRepaint();
            await sleep(100);

            expect(errorHandler).toHaveBeenCalledTimes(1);

        });
    });

    test('emits load event when source TileJSON fails to load', async () => {
        const style: StyleSpecification = {
            ...createStyle(),
            sources: {
                'source': {
                    type: 'vector',
                    url: 'maplibre://nonexistent'
                }
            },
            layers: [
                {
                    id: 'layer',
                    source: 'source',
                    type: 'fill',
                    'source-layer': 'test'
                }
            ]
        };
        const map = createMap();
        map.setStyle(style);

        await map.once('load');
        expect(map.isStyleLoaded()).toBe(true);

        map.triggerRepaint();
        await map.once('idle');
    });

    describe('projectiontransition event', () => {
        test('projectiontransition events is fired when setProjection is called', async () => {
            const map = createMap();

            await map.once('load');

            const spy = vi.fn();
            map.on('projectiontransition', (e) => spy(e.newProjection));
            map.setProjection({
                type: 'globe',
            });
            map.setProjection({
                type: 'mercator',
            });
            expect(spy).toHaveBeenCalledTimes(2);
            expect(spy).toHaveBeenNthCalledWith(1, 'globe');
            expect(spy).toHaveBeenNthCalledWith(2, 'mercator');
        });
        test('projectiontransition is fired when globe transitions to mercator', async () => {
            const map = createMap();
            vi.spyOn(GlobeProjection.prototype, 'updateGPUdependent').mockImplementation(() => {});
            await map.once('load');

            const spy = vi.fn();
            map.on('projectiontransition', (e) => spy(e.newProjection));

            map.setProjection({
                type: 'globe',
            });
            map.setZoom(18);
            map.redraw();
            await sleep(550);
            map.redraw();
            map.setZoom(0);
            map.redraw();
            await sleep(550);
            map.redraw();
            map.setProjection({
                type: 'mercator',
            });

            expect(spy).toHaveBeenCalledTimes(2);
            expect(spy).toHaveBeenNthCalledWith(1, 'globe');
            expect(spy).toHaveBeenNthCalledWith(2, 'mercator');
        });
    });
});
