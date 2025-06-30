import {beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {type IControl} from '../control/control';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('addControl', () => {
    const map = createMap();
    const control = {
        onAdd(_) {
            expect(map).toBe(_);
            return window.document.createElement('div');
        }
    } as any as IControl;
    map.addControl(control);
    expect(map._controls[0]).toBe(control);
});

test('removeControl errors on invalid arguments', () => {
    const map = createMap();
    const control = {} as any as IControl;
    const stub = vi.spyOn(console, 'error').mockImplementation(() => {});

    map.addControl(control);
    map.removeControl(control);
    expect(stub).toHaveBeenCalledTimes(2);

});

test('removeControl', () => {
    const map = createMap();
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
    expect(map._controls).toHaveLength(0);

});

test('hasControl', () => {
    const map = createMap();
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
});
