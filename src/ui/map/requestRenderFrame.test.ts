import {createMap, setMatchMedia, setPerformance, setWebGlContext} from '../../util/test/util';

beforeEach(() => {
    setPerformance();
    setWebGlContext();
    setMatchMedia();
});

describe('requestRenderFrame', () => {

    test('Map#_requestRenderFrame schedules a new render frame if necessary', () => {
        const map = createMap();
        const spy = jest.spyOn(map, 'triggerRepaint');
        map._requestRenderFrame(() => {});
        expect(spy).toHaveBeenCalledTimes(1);
        map.remove();
    });

    test('Map#_requestRenderFrame queues a task for the next render frame', done => {
        const map = createMap();
        const cb = jest.fn();
        map._requestRenderFrame(cb);
        map.once('render', () => {
            expect(cb).toHaveBeenCalledTimes(1);
            map.remove();
            done();
        });
    });

    test('Map#_cancelRenderFrame cancels a queued task', done => {
        const map = createMap();
        const cb = jest.fn();
        const id = map._requestRenderFrame(cb);
        map._cancelRenderFrame(id);
        map.once('render', () => {
            expect(cb).toHaveBeenCalledTimes(0);
            map.remove();
            done();
        });
    });
});
