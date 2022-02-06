import simulate, {window} from '../../test/unit/lib/simulate_interaction';
import StyleLayer from '../style/style_layer';
import {createMap, setPerformance, setWebGlContext} from '../util/test/util';
import {MapLayerEventType} from './events';

beforeEach(() => {
    setPerformance();
    setWebGlContext();
});

describe('map events', () => {

    test('Map#on adds a non-delegated event listener', () => {
        const map = createMap();
        const spy = jest.fn(function (e) {
            expect(this).toBe(map);
            expect(e.type).toBe('click');
        });

        map.on('click', spy);
        simulate.click(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map#off removes a non-delegated event listener', () => {
        const map = createMap();
        const spy = jest.fn();

        map.on('click', spy);
        map.off('click', spy);
        simulate.click(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();

    });

    test('Map#on adds a listener for an event on a given layer', () => {
        const map = createMap();
        const features = [{}];

        jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        jest.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            expect(options).toEqual({layers: ['layer']});
            return features;
        });

        const spy = jest.fn(function (e) {
            expect(this).toBe(map);
            expect(e.type).toBe('click');
            expect(e.features).toBe(features);
        });

        map.on('click', 'layer', spy);
        simulate.click(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map#on adds a listener not triggered for events not matching any features', () => {
        const map = createMap();
        const features = [];

        jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        jest.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            expect(options).toEqual({layers: ['layer']});
            return features;
        });

        const spy = jest.fn();

        map.on('click', 'layer', spy);
        simulate.click(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();

    });

    test('Map#on adds a listener not triggered when the specified layer does not exiist', () => {
        const map = createMap();

        jest.spyOn(map, 'getLayer').mockReturnValue(null);

        const spy = jest.fn();

        map.on('click', 'layer', spy);
        simulate.click(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();

    });

    test('Map#on distinguishes distinct event types', () => {
        const map = createMap();

        jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{}]);

        const spyDown = jest.fn((e) => {
            expect(e.type).toBe('mousedown');
        });

        const spyUp = jest.fn((e) => {
            expect(e.type).toBe('mouseup');
        });

        map.on('mousedown', 'layer', spyDown);
        map.on('mouseup', 'layer', spyUp);
        simulate.click(map.getCanvas());

        expect(spyDown).toHaveBeenCalledTimes(1);
        expect(spyUp).toHaveBeenCalledTimes(1);
    });

    test('Map#on distinguishes distinct layers', () => {
        const map = createMap();
        const featuresA = [{}];
        const featuresB = [{}];

        jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        jest.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            return (options as any).layers[0] === 'A' ? featuresA : featuresB;
        });

        const spyA = jest.fn((e) => {
            expect(e.features).toBe(featuresA);
        });

        const spyB = jest.fn((e) => {
            expect(e.features).toBe(featuresB);
        });

        map.on('click', 'A', spyA);
        map.on('click', 'B', spyB);
        simulate.click(map.getCanvas());

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).toHaveBeenCalledTimes(1);
    });

    test('Map#on distinguishes distinct listeners', () => {
        const map = createMap();

        jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{}]);

        const spyA = jest.fn();
        const spyB = jest.fn();

        map.on('click', 'layer', spyA);
        map.on('click', 'layer', spyB);
        simulate.click(map.getCanvas());

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).toHaveBeenCalledTimes(1);
    });

    test('Map#off removes a delegated event listener', () => {
        const map = createMap();

        jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{}]);

        const spy = jest.fn();

        map.on('click', 'layer', spy);
        map.off('click', 'layer', spy);
        simulate.click(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();

    });

    test('Map#off distinguishes distinct event types', () => {
        const map = createMap();

        jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{}]);

        const spy = jest.fn((e) => {
            expect(e.type).toBe('mousedown');
        });

        map.on('mousedown', 'layer', spy);
        map.on('mouseup', 'layer', spy);
        map.off('mouseup', 'layer', spy);
        simulate.click(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map#off distinguishes distinct layers', () => {
        const map = createMap();
        const featuresA = [{}];

        jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        jest.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            expect(options).toEqual({layers: ['A']});
            return featuresA;
        });

        const spy = jest.fn((e) => {
            expect(e.features).toBe(featuresA);
        });

        map.on('click', 'A', spy);
        map.on('click', 'B', spy);
        map.off('click', 'B', spy);
        simulate.click(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('Map#off distinguishes distinct listeners', () => {
        const map = createMap();

        jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
        jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{}]);

        const spyA = jest.fn();
        const spyB = jest.fn();

        map.on('click', 'layer', spyA);
        map.on('click', 'layer', spyB);
        map.off('click', 'layer', spyB);
        simulate.click(map.getCanvas());

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).not.toHaveBeenCalled();
    });

    (['mouseenter', 'mouseover'] as (keyof MapLayerEventType)[]).forEach((event) => {
        test(`Map#on ${event} does not fire if the specified layer does not exist`, () => {
            const map = createMap();

            jest.spyOn(map, 'getLayer').mockReturnValue(null);

            const spy = jest.fn();

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).not.toHaveBeenCalled();

        });

        test(`Map#on ${event} fires when entering the specified layer`, () => {
            const map = createMap();
            const features = [{}];

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
                expect(options).toEqual({layers: ['layer']});
                return features;
            });

            const spy = jest.fn(function (e) {
                expect(this).toBe(map);
                expect(e.type).toBe(event);
                expect(e.target).toBe(map);
                expect(e.features).toBe(features);
            });

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test(`Map#on ${event} does not fire on mousemove within the specified layer`, () => {
            const map = createMap();

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{}]);

            const spy = jest.fn();

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test(`Map#on ${event} fires when reentering the specified layer`, () => {
            const map = createMap();

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures')
                .mockReturnValueOnce([{}])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([{}]);

            const spy = jest.fn();

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(2);
        });

        test(`Map#on ${event} fires when reentering the specified layer after leaving the canvas`, () => {
            const map = createMap();

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{}]);

            const spy = jest.fn();

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mouseout(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(2);
        });

        test(`Map#on ${event} distinguishes distinct layers`, () => {
            const map = createMap();
            const featuresA = [{}];
            const featuresB = [{}];

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
                return (options as any).layers[0] === 'A' ? featuresA : featuresB;
            });

            const spyA = jest.fn((e) => {
                expect(e.features).toBe(featuresA);
            });

            const spyB = jest.fn((e) => {
                expect(e.features).toBe(featuresB);
            });

            map.on(event, 'A', spyA);
            map.on(event, 'B', spyB);

            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spyA).toHaveBeenCalledTimes(1);
            expect(spyB).toHaveBeenCalledTimes(1);
        });

        test(`Map#on ${event} distinguishes distinct listeners`, () => {
            const map = createMap();

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{}]);

            const spyA = jest.fn();
            const spyB = jest.fn();

            map.on(event, 'layer', spyA);
            map.on(event, 'layer', spyB);
            simulate.mousemove(map.getCanvas());

            expect(spyA).toHaveBeenCalledTimes(1);
            expect(spyB).toHaveBeenCalledTimes(1);
        });

        test(`Map#off ${event} removes a delegated event listener`, () => {
            const map = createMap();

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{}]);

            const spy = jest.fn();

            map.on(event, 'layer', spy);
            map.off(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());

            expect(spy).not.toHaveBeenCalled();

        });

        test(`Map#off ${event} distinguishes distinct layers`, () => {
            const map = createMap();
            const featuresA = [{}];

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
                expect(options).toEqual({layers: ['A']});
                return featuresA;
            });

            const spy = jest.fn((e) => {
                expect(e.features).toBe(featuresA);
            });

            map.on(event, 'A', spy);
            map.on(event, 'B', spy);
            map.off(event, 'B', spy);
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test(`Map#off ${event} distinguishes distinct listeners`, () => {
            const map = createMap();

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{}]);

            const spyA = jest.fn();
            const spyB = jest.fn();

            map.on(event, 'layer', spyA);
            map.on(event, 'layer', spyB);
            map.off(event, 'layer', spyB);
            simulate.mousemove(map.getCanvas());

            expect(spyA).toHaveBeenCalledTimes(1);
            expect(spyB).not.toHaveBeenCalled();
        });
    });

    (['mouseleave', 'mouseout'] as (keyof MapLayerEventType)[]).forEach((event) => {
        test(`Map#on ${event} does not fire if the specified layer does not exiist`, () => {
            const map = createMap();

            jest.spyOn(map, 'getLayer').mockReturnValue(null);

            const spy = jest.fn();

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).not.toHaveBeenCalled();

        });

        test(`Map#on ${event} does not fire on mousemove when entering or within the specified layer`, () => {
            const map = createMap();

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{}]);

            const spy = jest.fn();

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).not.toHaveBeenCalled();

        });

        test(`Map#on ${event} fires when exiting the specified layer`, () => {
            const map = createMap();

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures')
                .mockReturnValueOnce([{}])
                .mockReturnValueOnce([]);

            const spy = jest.fn(function (e) {
                expect(this).toBe(map);
                expect(e.type).toBe(event);
                expect(e.features).toBeUndefined();
            });

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test(`Map#on ${event} fires when exiting the canvas`, () => {
            const map = createMap();

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures').mockReturnValue([{}]);

            const spy = jest.fn(function (e) {
                expect(this).toBe(map);
                expect(e.type).toBe(event);
                expect(e.features).toBeUndefined();
            });

            map.on(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mouseout(map.getCanvas());

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test(`Map#off ${event} removes a delegated event listener`, () => {
            const map = createMap();

            jest.spyOn(map, 'getLayer').mockReturnValue({} as StyleLayer);
            jest.spyOn(map, 'queryRenderedFeatures')
                .mockReturnValueOnce([{}])
                .mockReturnValueOnce([]);

            const spy = jest.fn();

            map.on(event, 'layer', spy);
            map.off(event, 'layer', spy);
            simulate.mousemove(map.getCanvas());
            simulate.mousemove(map.getCanvas());
            simulate.mouseout(map.getCanvas());

            expect(spy).not.toHaveBeenCalled();

        });
    });

    test('Map#on mousedown can have default behavior prevented and still fire subsequent click event', () => {
        const map = createMap();

        map.on('mousedown', e => e.preventDefault());

        const click = jest.fn();
        map.on('click', click);

        simulate.click(map.getCanvas());
        expect(click).toHaveBeenCalled();

        map.remove();
    });

    test('Map#on mousedown doesn\'t fire subsequent click event if mousepos changes', () => {
        const map = createMap();

        map.on('mousedown', e => e.preventDefault());

        const click = jest.fn();
        map.on('click', click);
        const canvas = map.getCanvas();

        simulate.drag(canvas, {}, {clientX: 100, clientY: 100});
        expect(click).not.toHaveBeenCalled();

        map.remove();
    });

    test('Map#on mousedown fires subsequent click event if mouse position changes less than click tolerance', () => {
        const map = createMap({clickTolerance: 4});

        map.on('mousedown', e => e.preventDefault());

        const click = jest.fn();
        map.on('click', click);
        const canvas = map.getCanvas();

        simulate.drag(canvas, {clientX: 100, clientY: 100}, {clientX: 100, clientY: 103});
        expect(click).toHaveBeenCalled();

        map.remove();
    });

    test('Map#on mousedown does not fire subsequent click event if mouse position changes more than click tolerance', () => {
        const map = createMap({clickTolerance: 4});

        map.on('mousedown', e => e.preventDefault());

        const click = jest.fn();
        map.on('click', click);
        const canvas = map.getCanvas();

        simulate.drag(canvas, {clientX: 100, clientY: 100}, {clientX: 100, clientY: 104});
        expect(click).not.toHaveBeenCalled();

        map.remove();
    });

    test('Map#on click fires subsequent click event if there is no corresponding mousedown/mouseup event', () => {
        const map = createMap({clickTolerance: 4});

        const click = jest.fn();
        map.on('click', click);
        const canvas = map.getCanvas();

        const MouseEvent = window(canvas).MouseEvent;
        const event = new MouseEvent('click', {bubbles: true, clientX: 100, clientY: 100});
        canvas.dispatchEvent(event);
        expect(click).toHaveBeenCalled();

        map.remove();
    });

    test('Map#isMoving() returns false in mousedown/mouseup/click with no movement', () => {
        const map = createMap({interactive: true, clickTolerance: 4});
        let mousedown, mouseup, click;
        map.on('mousedown', () => { mousedown = map.isMoving(); });
        map.on('mouseup', () => { mouseup = map.isMoving(); });
        map.on('click', () => { click = map.isMoving(); });

        const canvas = map.getCanvas();
        const MouseEvent = window(canvas).MouseEvent;

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
});
