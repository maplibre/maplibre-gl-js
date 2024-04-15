import {createMap, beforeMapTest, sleep} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('#resize', () => {
    test('sets width and height from container clients', () => {
        const map = createMap(),
            container = map.getContainer();

        Object.defineProperty(container, 'clientWidth', {value: 250});
        Object.defineProperty(container, 'clientHeight', {value: 250});
        map.resize();

        expect(map.transform.width).toBe(250);
        expect(map.transform.height).toBe(250);

    });

    test('fires movestart, move, resize, and moveend events', () => {
        const map = createMap(),
            events = [];

        (['movestart', 'move', 'resize', 'moveend'] as any).forEach((event) => {
            map.on(event, (e) => {
                events.push(e.type);
            });
        });

        map.resize();
        expect(events).toEqual(['movestart', 'move', 'resize', 'moveend']);

    });

    test('listen to window resize event', () => {
        const spy = jest.fn();
        global.ResizeObserver = jest.fn().mockImplementation(() => ({
            observe: spy
        }));

        createMap();

        expect(spy).toHaveBeenCalled();
    });

    test('do not resize if trackResize is false', () => {
        let observerCallback: Function = null;
        global.ResizeObserver = jest.fn().mockImplementation((c) => ({
            observe: () => { observerCallback = c; }
        }));

        const map = createMap({trackResize: false});

        const spyA = jest.spyOn(map, 'stop');
        const spyB = jest.spyOn(map, '_update');
        const spyC = jest.spyOn(map, 'resize');

        observerCallback();

        expect(spyA).not.toHaveBeenCalled();
        expect(spyB).not.toHaveBeenCalled();
        expect(spyC).not.toHaveBeenCalled();
    });

    test('do resize if trackResize is true (default)', async () => {
        let observerCallback: Function = null;
        global.ResizeObserver = jest.fn().mockImplementation((c) => ({
            observe: () => { observerCallback = c; }
        }));

        const map = createMap();

        const updateSpy = jest.spyOn(map, '_update');
        const resizeSpy = jest.spyOn(map, 'resize');

        // The initial "observe" event fired by ResizeObserver should be captured/muted
        // in the map constructor

        observerCallback();
        expect(updateSpy).not.toHaveBeenCalled();
        expect(resizeSpy).not.toHaveBeenCalled();

        // The next "observe" event should fire a resize / _update

        observerCallback();
        expect(updateSpy).toHaveBeenCalled();
        expect(resizeSpy).toHaveBeenCalledTimes(1);

        // Additional "observe" events should be throttled
        observerCallback();
        observerCallback();
        observerCallback();
        observerCallback();
        expect(resizeSpy).toHaveBeenCalledTimes(1);
        await sleep(100);
        expect(resizeSpy).toHaveBeenCalledTimes(2);
    });

    test('width and height correctly rounded', () => {
        const map = createMap();
        const container = map.getContainer();

        Object.defineProperty(container, 'clientWidth', {value: 250.6});
        Object.defineProperty(container, 'clientHeight', {value: 250.6});
        map.resize();

        expect(map.getCanvas().width).toBe(250);
        expect(map.getCanvas().height).toBe(250);
        expect(map.painter.width).toBe(250);
        expect(map.painter.height).toBe(250);
    });
});
