import {describe, beforeEach, test, expect} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('#getRenderWorldCopies', () => {
    test('initially false', () => {
        const map = createMap({renderWorldCopies: false});
        expect(map.getRenderWorldCopies()).toBe(false);
    });

    test('initially true', () => {
        const map = createMap({renderWorldCopies: true});
        expect(map.getRenderWorldCopies()).toBe(true);
    });

});

describe('#setRenderWorldCopies', () => {
    test('initially false', () => {
        const map = createMap({renderWorldCopies: false});
        map.setRenderWorldCopies(true);
        expect(map.getRenderWorldCopies()).toBe(true);
    });

    test('initially true', () => {
        const map = createMap({renderWorldCopies: true});
        map.setRenderWorldCopies(false);
        expect(map.getRenderWorldCopies()).toBe(false);
    });

    test('undefined', () => {
        const map = createMap({renderWorldCopies: false});
        map.setRenderWorldCopies(undefined);
        expect(map.getRenderWorldCopies()).toBe(true);
    });

    test('null', () => {
        const map = createMap({renderWorldCopies: true});
        map.setRenderWorldCopies(null);
        expect(map.getRenderWorldCopies()).toBe(false);
    });

});

describe('#renderWorldCopies', () => {
    test('does not constrain horizontal panning when renderWorldCopies is set to true', () => {
        const map = createMap({renderWorldCopies: true});
        map.setCenter({lng: 180, lat: 0});
        expect(map.getCenter().lng).toBe(180);
    });

    test('constrains horizontal panning when renderWorldCopies is set to false', () => {
        const map = createMap({renderWorldCopies: false});
        map.setCenter({lng: 180, lat: 0});
        expect(map.getCenter().lng).toBeCloseTo(110, 0);
    });

    test('does not wrap the map when renderWorldCopies is set to false', () => {
        const map = createMap({renderWorldCopies: false});
        map.setCenter({lng: 200, lat: 0});
        expect(map.getCenter().lng).toBeCloseTo(110, 0);
    });

    test('panTo is constrained to single globe when renderWorldCopies is set to false', () => {
        const map = createMap({renderWorldCopies: false});
        map.panTo({lng: 180, lat: 0}, {duration: 0});
        expect(map.getCenter().lng).toBeCloseTo(110, 0);
        map.panTo({lng: -3000, lat: 0}, {duration: 0});
        expect(map.getCenter().lng).toBeCloseTo(-110, 0);
    });

    test('flyTo is constrained to single globe when renderWorldCopies is set to false', () => {
        const map = createMap({renderWorldCopies: false});
        map.flyTo({center: [1000, 0], zoom: 3, animate: false});
        expect(map.getCenter().lng).toBeCloseTo(171, 0);
        map.flyTo({center: [-1000, 0], zoom: 5, animate: false});
        expect(map.getCenter().lng).toBeCloseTo(-178, 0);
    });

    test('lng is constrained to a single globe when zooming with {renderWorldCopies: false}', () => {
        const map = createMap({renderWorldCopies: false, center: [180, 0], zoom: 2});
        expect(map.getCenter().lng).toBeCloseTo(162, 0);
        map.zoomTo(1, {animate: false});
        expect(map.getCenter().lng).toBeCloseTo(145, 0);
    });

    test('lng is constrained by maxBounds when {renderWorldCopies: false}', () => {
        const map = createMap({
            renderWorldCopies: false,
            maxBounds: [
                [70, 30],
                [80, 40]
            ],
            zoom: 8,
            center: [75, 35]
        });
        map.setCenter({lng: 180, lat: 0});
        expect(map.getCenter().lng).toBeCloseTo(80, 0);
    });
});
