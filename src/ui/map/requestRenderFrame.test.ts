import '../../../stub_loader';
import {test} from '../../../util/test';
import {createMap} from '../../../util';

describe('Map#_requestRenderFrame schedules a new render frame if necessary', done => {
    const map = createMap(t);
    t.stub(map, 'triggerRepaint');
    map._requestRenderFrame(() => {});
    expect(map.triggerRepaint).toHaveBeenCalledTimes(1);
    map.remove();
    done();
});

describe('Map#_requestRenderFrame queues a task for the next render frame', done => {
    const map = createMap(t);
    const cb = jest.fn();
    map._requestRenderFrame(cb);
    map.once('render', () => {
        expect(cb).toHaveBeenCalledTimes(1);
        map.remove();
        done();
    });
});

describe('Map#_cancelRenderFrame cancels a queued task', done => {
    const map = createMap(t);
    const cb = jest.fn();
    const id = map._requestRenderFrame(cb);
    map._cancelRenderFrame(id);
    map.once('render', () => {
        expect(cb).toHaveBeenCalledTimes(0);
        map.remove();
        done();
    });
});
