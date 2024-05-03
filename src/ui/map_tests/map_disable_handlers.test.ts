import {createMap, beforeMapTest} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('disable all handlers', () => {
    const map = createMap({interactive: false});

    expect(map.boxZoom.isEnabled()).toBeFalsy();
    expect(map.doubleClickZoom.isEnabled()).toBeFalsy();
    expect(map.dragPan.isEnabled()).toBeFalsy();
    expect(map.dragRotate.isEnabled()).toBeFalsy();
    expect(map.keyboard.isEnabled()).toBeFalsy();
    expect(map.scrollZoom.isEnabled()).toBeFalsy();
    expect(map.touchZoomRotate.isEnabled()).toBeFalsy();
});

const handlerNames = [
    'scrollZoom',
    'boxZoom',
    'dragRotate',
    'dragPan',
    'keyboard',
    'doubleClickZoom',
    'touchZoomRotate'
];
handlerNames.forEach((handlerName) => {
    test(`disable "${handlerName}" handler`, () => {
        const options = {};
        options[handlerName] = false;
        const map = createMap(options);

        expect(map[handlerName].isEnabled()).toBeFalsy();

    });
});
