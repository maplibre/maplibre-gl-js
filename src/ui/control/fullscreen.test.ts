import '../../../stub_loader';
import {test} from '../../../util/test';
import {createMap} from '../../../util';
import FullscreenControl from '../../ui/control/fullscreen_control';

describe('FullscreenControl appears when fullscreen is enabled', () => {
    window.document.fullscreenEnabled = true;

    const map = createMap(t);
    const fullscreen = new FullscreenControl();
    map.addControl(fullscreen);

    expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-fullscreen').length).toBe(1);
});

describe('FullscreenControl does not appear when fullscreen is not enabled', () => {
    window.document.fullscreenEnabled = false;

    const consoleWarn = t.stub(console, 'warn');

    const map = createMap(t);
    const fullscreen = new FullscreenControl();
    map.addControl(fullscreen);

    expect(map.getContainer().querySelectorAll('.maplibregl-ctrl-fullscreen').length).toBe(0);
    expect(consoleWarn.getCall(0).args[0]).toBe('This device does not support fullscreen mode.');
});

describe('FullscreenControl makes optional container element full screen', () => {
    window.document.fullscreenEnabled = true;

    const map = createMap(t);
    const fullscreen = new FullscreenControl({container: window.document.querySelector('body')});
    map.addControl(fullscreen);
    const control = map._controls.find((ctrl) => {
        return Object.prototype.hasOwnProperty.call(ctrl, '_fullscreen');
    });
    control._onClickFullscreen();

    expect(control._container.tagName).toBe('BODY');
});
