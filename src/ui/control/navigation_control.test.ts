import simulate from '../../../test/unit/lib/simulate_interaction';
import {createMap as globalCreateMap, setWebGlContext, setPerformance} from '../../util/test/util';
import NavigationControl from './navigation_control';

function createMap() {
    return globalCreateMap({
        style: {
            version: 8,
            owner: 'mapblibre',
            id: 'demotiles',
        }
    });
}

let map;

beforeEach(() => {
    setWebGlContext();
    setPerformance();
    map = createMap();
});

afterEach(() => {
    map.remove();
});

describe('NavigationControl', () => {
    test('appears in the top-right', () => {
        map.addControl(new NavigationControl());

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-top-right > .maplibregl-ctrl')
        ).toHaveLength(1);
    });

    test('contains zoom in button', () => {
        map.addControl(new NavigationControl());

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-zoom-in')
        ).toHaveLength(1);
    });

    test('contains zoom out button', () => {
        map.addControl(new NavigationControl());

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-zoom-out')
        ).toHaveLength(1);
    });

    test('contains compass button', () => {
        map.addControl(new NavigationControl());

        expect(
            map.getContainer().querySelectorAll('.maplibregl-ctrl-compass')
        ).toHaveLength(1);
    });

    test('compass button reset action', () => {
        map.setPitch(10);
        map.setBearing(10);

        map.addControl(new NavigationControl({
            visualizePitch: true,
            showZoom: true,
            showCompass: true
        }));
        const spyReset = jest.spyOn(map, 'resetNorthPitch');
        const navButton = map.getContainer().querySelector('.maplibregl-ctrl-compass');

        simulate.click(navButton);
        map._renderTaskQueue.run();

        expect(spyReset).toHaveBeenCalledTimes(1);
    });
});
