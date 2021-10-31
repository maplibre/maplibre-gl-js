import {createMap, setWebGlContext} from '../../util/test/util';
import FullscreenControl from './fullscreen_control';

beforeEach(() => {
    setWebGlContext();
    window.performance.mark = jest.fn();
});

describe('FullscreenControl', () => {
    test('appears when fullscreen is enabled', () => {
        Object.defineProperty(window.document, 'fullscreenEnabled', {
            value: true,
            writable: true,
        });
        const map = createMap(undefined, undefined);
        const fullscreen = new FullscreenControl(undefined);
        map.addControl(fullscreen);

        expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-fullscreen')).toHaveLength(1);
    });

    test('does not appear when fullscreen is not enabled', () => {
        Object.defineProperty(window.document, 'fullscreenEnabled', {
            value: false,
            writable: true,
        });

        jest.spyOn(console, 'warn').mockImplementation(() => { });

        const map = createMap(undefined, undefined);
        const fullscreen = new FullscreenControl(undefined);
        map.addControl(fullscreen);

        expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-fullscreen')).toHaveLength(0);
        expect(console.warn).toHaveBeenCalledWith('This device does not support fullscreen mode.');
    });

    test('makes optional container element full screen', () => {
        Object.defineProperty(window.document, 'fullscreenEnabled', {
            value: true,
            writable: true,
        });

        const map = createMap(undefined, undefined);
        const fullscreen = new FullscreenControl({container: window.document.querySelector('body')});
        map.addControl(fullscreen);
        const control = map._controls.find((ctrl) => {
            return Object.prototype.hasOwnProperty.call(ctrl, '_fullscreen');
        }) as FullscreenControl;
        control._onClickFullscreen();

        expect(control._container.tagName).toBe('BODY');
    });
});
