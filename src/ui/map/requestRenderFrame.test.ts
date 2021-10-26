import {createMap, setWebGlContext, setPerformance, setMatchMedia} from '../../util/test/util';

beforeEach(() => {
    setWebGlContext();
    setPerformance();
    setMatchMedia();
});

describe('Map#', () => {
    test('_requestRenderFrame schedules a new render frame if necessary', () => {
        const map = createMap(undefined, undefined);
        const triggerRepaint = jest.spyOn(map, 'triggerRepaint').mockImplementation(() => { });
        map._requestRenderFrame(() => {});
        expect(triggerRepaint).toHaveBeenCalledTimes(1);
        map.remove();
    });

    test('_requestRenderFrame queues a task for the next render frame', done => {
        const map = createMap(undefined, undefined);
        const cb = jest.fn();
        map._requestRenderFrame(cb);
        map.once('render', () => {
            expect(cb).toHaveBeenCalledTimes(1);
            map.remove();
            done();
        });
    });

    test('_cancelRenderFrame cancels a queued task', done => {
        const map = createMap(undefined, undefined);
        const cb = jest.fn();
        const id = map._requestRenderFrame(cb);
        map._cancelRenderFrame(id);
        map.once('render', () => {
            expect(cb).not.toHaveBeenCalled();
            map.remove();
            done();
        });
    });
});
