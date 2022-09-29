import {createMap, setWebGlContext} from '../../util/test/util';
import FullscreenControl from './fullscreen_control';

beforeEach(() => {
    setWebGlContext();
    window.performance.mark = jest.fn();
});

describe('FullscreenControl', () => {
    test('renders control', () => {
        Object.defineProperty(window.document, 'fullscreenEnabled', {
            value: true,
            writable: true,
        });
        const map = createMap(undefined, undefined);
        const fullscreen = new FullscreenControl({});
        map.addControl(fullscreen);

        expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-fullscreen')).toHaveLength(1);
    });

    test('makes optional container element full screen', () => {
        Object.defineProperty(window.document, 'fullscreenEnabled', {
            value: true,
            writable: true,
        });

        const map = createMap(undefined, undefined);
        const container = window.document.querySelector('body')!;
        const fullscreen = new FullscreenControl({container});
        map.addControl(fullscreen);
        const control = map._controls.find((ctrl) => {
            return Object.prototype.hasOwnProperty.call(ctrl, '_fullscreen');
        }) as FullscreenControl;
        control._onClickFullscreen();

        expect(control._container.tagName).toBe('BODY');
    });

    test('uses pseudo fullscreen when fullscreen is not supported', () => {
        const map = createMap(undefined, undefined);
        const mapContainer = map.getContainer();

        const fullscreen = new FullscreenControl({});
        map.addControl(fullscreen);
        const control = map._controls.find((ctrl) => {
            return Object.prototype.hasOwnProperty.call(ctrl, '_fullscreen');
        }) as FullscreenControl;

        expect(mapContainer.classList.contains('maplibregl-pseudo-fullscreen')).toBe(false);
        control._onClickFullscreen();
        expect(mapContainer.classList.contains('maplibregl-pseudo-fullscreen')).toBe(true);
        control._onClickFullscreen();
        expect(mapContainer.classList.contains('maplibregl-pseudo-fullscreen')).toBe(false);
    });
});
