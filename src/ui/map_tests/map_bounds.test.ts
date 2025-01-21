import {describe, beforeEach, test, expect} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {fixedLngLat, fixedNum} from '../../../test/unit/lib/fixed';
import {type LngLatBoundsLike} from '../../geo/lng_lat_bounds';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('initial bounds in constructor options', () => {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: 512});
    Object.defineProperty(container, 'offsetHeight', {value: 512});

    const bounds = [[-133, 16], [-68, 50]];
    const map = createMap({container, bounds});

    expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
    expect(fixedNum(map.getZoom(), 3)).toBe(2.113);
});

test('initial bounds options in constructor options', () => {
    const bounds = [[-133, 16], [-68, 50]];

    const map = (fitBoundsOptions) => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'offsetWidth', {value: 512});
        Object.defineProperty(container, 'offsetHeight', {value: 512});
        return createMap({container, bounds, fitBoundsOptions});
    };

    const unpadded = map(undefined);
    const padded = map({padding: 100});

    expect(unpadded.getZoom() > padded.getZoom()).toBeTruthy();
});

describe('#getBounds', () => {

    test('getBounds', () => {
        const map = createMap({zoom: 0});
        expect(parseFloat(map.getBounds().getCenter().lng.toFixed(10))).toBeCloseTo(0, 10);
        expect(parseFloat(map.getBounds().getCenter().lat.toFixed(10))).toBeCloseTo(0, 10);

        expect(toFixed(map.getBounds().toArray())).toEqual(toFixed([
            [-70.31249999999976, -57.326521225216965],
            [70.31249999999977, 57.32652122521695]]));
    });

    test('rotated bounds', () => {
        const map = createMap({zoom: 1, bearing: 45});
        expect(
            toFixed([[-49.718445552178764, -44.44541580601936], [49.7184455522, 44.445415806019355]])
        ).toEqual(toFixed(map.getBounds().toArray()));

        map.setBearing(135);
        expect(
            toFixed([[-49.718445552178764, -44.44541580601936], [49.7184455522, 44.445415806019355]])
        ).toEqual(toFixed(map.getBounds().toArray()));

    });

    function toFixed(bounds) {
        const n = 10;
        return [
            [normalizeFixed(bounds[0][0], n), normalizeFixed(bounds[0][1], n)],
            [normalizeFixed(bounds[1][0], n), normalizeFixed(bounds[1][1], n)]
        ];
    }

    function normalizeFixed(num, n) {
        // workaround for "-0.0000000000" ≠ "0.0000000000"
        return parseFloat(num.toFixed(n)).toFixed(n);
    }
});

describe('#setMaxBounds', () => {
    test('constrains map bounds', () => {
        const map = createMap({zoom: 0});
        map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
        expect(
            toFixed([[-130.4297000000, 7.0136641176], [-61.5234400000, 60.2398142283]])
        ).toEqual(toFixed(map.getBounds().toArray()));
    });

    test('when no argument is passed, map bounds constraints are removed', () => {
        const map = createMap({zoom: 0});
        map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
        expect(
            toFixed([[-166.28906999999964, -27.6835270554], [-25.664070000000066, 73.8248206697]])
        ).toEqual(toFixed(map.setMaxBounds(null).setZoom(0).getBounds().toArray()));
    });

    test('should not zoom out farther than bounds', () => {
        const map = createMap();
        map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
        expect(map.setZoom(0).getZoom()).not.toBe(0);
    });

    function toFixed(bounds) {
        const n = 9;
        return [
            [bounds[0][0].toFixed(n), bounds[0][1].toFixed(n)],
            [bounds[1][0].toFixed(n), bounds[1][1].toFixed(n)]
        ];
    }

});

describe('#getMaxBounds', () => {
    test('returns null when no bounds set', () => {
        const map = createMap({zoom: 0});
        expect(map.getMaxBounds()).toBeNull();
    });

    test('returns bounds', () => {
        const map = createMap({zoom: 0});
        const bounds = [[-130.4297, 50.0642], [-61.52344, 24.20688]] as LngLatBoundsLike;
        map.setMaxBounds(bounds);
        expect(map.getMaxBounds().toArray()).toEqual(bounds);
    });

});
