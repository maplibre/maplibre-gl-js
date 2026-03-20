import {describe, beforeEach,  afterEach,  test, expect} from 'vitest';
import {Hash} from './hash';
import {createMap as globalCreateMap, beforeMapTest} from '../util/test/util';
import type {Map} from './map';

describe('hash', () => {
    function createHash(name: string = undefined) {
        const hash = new Hash(name);
        hash._updateHash = hash._updateHashUnthrottled.bind(hash);
        return hash;
    }

    function createMap() {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});
        return globalCreateMap({container});
    }

    let map: Map;

    beforeEach(() => {
        beforeMapTest();
        map = createMap();
    });

    afterEach(() => {
        if (map._removed === false) {
            map.remove();
        }
        window.location.hash = '';
    });

    test('addTo', () => {
        const hash = createHash();

        expect(hash._map).toBeFalsy();

        hash.addTo(map);

        expect(hash._map).toBeTruthy();
    });

    test('remove', () => {
        const hash = createHash()
            .addTo(map);

        expect(hash._map).toBeTruthy();

        hash.remove();

        expect(hash._map).toBeFalsy();
    });

    test('_onHashChange', () => {
        const hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';

        hash._onHashChange();

        expect(map.getCenter().lng).toBe(-1);
        expect(map.getCenter().lat).toBe(3);
        expect(map.getZoom()).toBe(10);
        expect(map.getBearing()).toBe(0);
        expect(map.getPitch()).toBe(0);

        // map is created with `interactive: false`
        // so explicitly enable rotation for this test
        map.dragRotate.enable();
        map.touchZoomRotate.enable();

        window.location.hash = '#5/1.00/0.50/30/60';

        hash._onHashChange();

        expect(map.getCenter().lng).toBe(0.5);
        expect(map.getCenter().lat).toBe(1);
        expect(map.getZoom()).toBe(5);
        expect(map.getBearing()).toBe(30);
        expect(map.getPitch()).toBe(60);

        // disable rotation to test that updating
        // the hash's bearing won't change the map
        map.dragRotate.disable();
        map.touchZoomRotate.disable();

        window.location.hash = '#5/1.00/0.50/-45/60';

        hash._onHashChange();

        expect(map.getCenter().lng).toBe(0.5);
        expect(map.getCenter().lat).toBe(1);
        expect(map.getZoom()).toBe(5);
        expect(map.getBearing()).toBe(30);
        expect(map.getPitch()).toBe(60);

        // test that a hash with no bearing resets
        // to the previous bearing when rotation is disabled
        window.location.hash = '#5/1.00/0.50/';

        hash._onHashChange();

        expect(map.getCenter().lng).toBe(0.5);
        expect(map.getCenter().lat).toBe(1);
        expect(map.getZoom()).toBe(5);
        expect(map.getBearing()).toBe(30);
        expect(window.location.hash).toBe('#5/1/0.5/30');

        window.location.hash = '#4/wrongly/formed/hash';

        expect(hash._onHashChange()).toBeFalsy();
    });

    test('_onHashChange empty', () => {
        const hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';

        hash._onHashChange();

        expect(map.getCenter().lng).toBe(-1);
        expect(map.getCenter().lat).toBe(3);
        expect(map.getZoom()).toBe(10);
        expect(map.getBearing()).toBe(0);
        expect(map.getPitch()).toBe(0);

        window.location.hash = '';

        hash._onHashChange();

        expect(map.getCenter().lng).toBe(-1);
        expect(map.getCenter().lat).toBe(3);
        expect(map.getZoom()).toBe(10);
        expect(map.getBearing()).toBe(0);
        expect(map.getPitch()).toBe(0);
    });

    test('_onHashChange named', () => {
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#map=10/3.00/-1.00&foo=bar';

        hash._onHashChange();

        expect(map.getCenter().lng).toBe(-1);
        expect(map.getCenter().lat).toBe(3);
        expect(map.getZoom()).toBe(10);
        expect(map.getBearing()).toBe(0);
        expect(map.getPitch()).toBe(0);

        window.location.hash = '#map&foo=bar';

        expect(hash._onHashChange()).toBeFalsy();

        window.location.hash = '#map=4/5/baz&foo=bar';

        expect(hash._onHashChange()).toBeFalsy();

        window.location.hash = '#5/1.00/0.50/30/60';

        expect(hash._onHashChange()).toBeFalsy();
    });

    test('_getCurrentHash', () => {
        const hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';
        expect(hash._getCurrentHash()).toStrictEqual(['10', '3.00', '-1.00']);
    });

    test('_getCurrentHash named', () => {
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#map=10/3.00/-1.00&foo=bar';
        expect(hash._getCurrentHash()).toStrictEqual(['10', '3.00', '-1.00']);

        window.location.hash = '#baz&map=10/3.00/-1.00';
        expect(hash._getCurrentHash()).toStrictEqual(['10', '3.00', '-1.00']);
    });

    describe('getHashString', () => {
        let hash: Hash;

        beforeEach(() => {
            hash = createHash()
                .addTo(map);
        });

        test('mapFeedback=true', () => {
            map.setZoom(10);
            map.setCenter([2.5, 3.75]);

            const hashStringWithFeedback = hash.getHashString(true);
            expect(hashStringWithFeedback).toBe('#/2.5/3.75/10');

            map.setBearing(45);
            map.setPitch(30);

            const hashStringWithRotationAndFeedback = hash.getHashString(true);
            expect(hashStringWithRotationAndFeedback).toBe('#/2.5/3.75/10/45/30');
        });

        test('mapFeedback=false', () => {
            map.setZoom(10);
            map.setCenter([2.5, 3.75]);

            const hashStringWithoutFeedback = hash.getHashString(false);
            expect(hashStringWithoutFeedback).toBe('#10/3.75/2.5');

            map.setBearing(45);
            map.setPitch(30);

            const hashStringWithRotationAndWithoutFeedback = hash.getHashString(false);
            expect(hashStringWithRotationAndWithoutFeedback).toBe('#10/3.75/2.5/45/30');
        });
    });

    test('_updateHash', () => {
        createHash()
            .addTo(map);

        expect(window.location.hash).toBeFalsy();

        map.setZoom(3);
        map.setCenter([2.0, 1.0]);

        expect(window.location.hash).toBe('#3/1/2');

        map.setPitch(60);

        expect(window.location.hash).toBe('#3/1/2/0/60');

        map.setBearing(135);

        expect(window.location.hash).toBe('#3/1/2/135/60');
    });

    test('_updateHash named', () => {
        createHash('map')
            .addTo(map);

        expect(window.location.hash).toBeFalsy();
        window.location.hash = '';

        map.setZoom(3);
        map.setCenter([1.0, 2.0]);

        expect(window.location.hash).toBeTruthy();

        expect(window.location.hash).toBe('#map=3/2/1');

        map.setPitch(60);

        expect(window.location.hash).toBe('#map=3/2/1/0/60');

        map.setBearing(135);

        expect(window.location.hash).toBe('#map=3/2/1/135/60');

        window.location.hash += '&foo=bar';

        map.setZoom(7);

        expect(window.location.hash).toBe('#map=7/2/1/135/60&foo=bar');

        window.location.hash = '#baz&map=7/2/1/135/60&foo=bar';

        map.setCenter([2.0, 1.0]);

        expect(window.location.hash).toBe('#baz&map=7/1/2/135/60&foo=bar');
    });

    describe('_removeHash without a name', () => {
        let hash: Hash;

        beforeEach(() => {
            hash = createHash()
                .addTo(map);
        });

        test('removes hash when hash is only map hash', () => {
            map.setZoom(3);
            map.setCenter([2.0, 1.0]);

            expect(window.location.hash).toBe('#3/1/2');

            hash._removeHash();

            expect(window.location.hash).toBe('');
        });

        test('removes hash when hash contains other parameters', () => {
            window.location.hash = '#3/1/2&foo=bar';

            hash._removeHash();

            expect(window.location.hash).toBe('#foo=bar');
        });
    });

    describe('_removeHash with a name', () => {
        let hash: Hash;

        beforeEach(() => {
            hash = createHash('map')
                .addTo(map);
        });

        test('removes hash when hash is only map hash', () => {
            map.setZoom(3);
            map.setCenter([2.0, 1.0]);
            expect(window.location.hash).toBe('#map=3/1/2');

            hash._removeHash();

            expect(window.location.hash).toBe('');
        });

        test('removes hash when hash contains other parameters at end', () => {
            window.location.hash = '#map=3/1/2&foo=bar';

            hash._removeHash();

            expect(window.location.hash).toBe('#foo=bar');
        });

        test('removes hash when hash contains other parameters at start and end', () => {
            window.location.hash = '#baz&map=7/2/1/135/60&foo=bar';

            hash._removeHash();

            expect(window.location.hash).toBe('#baz&foo=bar');
        });
    });

    describe('_isValidHash', () => {
        let hash: Hash;

        beforeEach(() => {
            hash = createHash()
                .addTo(map);
        });

        test('validate hash with zoom and center only', () => {
            window.location.hash = '#10/3.00/-1.00';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeTruthy();
        });

        test('validate hash with bearing and pitch', () => {
            window.location.hash = '#5/1.00/0.50/30/60';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeTruthy();
        });

        test('validate hash with negative bearing and positive pitch', () => {
            window.location.hash = '#5/1.00/0.50/-30/60';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeTruthy();
        });

        test('validate hash with positive bearing and negative pitch', () => {
            window.location.hash = '#5/1.00/0.50/-30/60';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeTruthy();
        });
        
        test('validate hash with bearing only', () => {
            window.location.hash = '#5/1.00/0.50/30';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeTruthy();
        });
        
        test('validate hash with negative bearing only', () => {
            window.location.hash = '#5/1.00/0.50/30';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeTruthy();
        });

        test('invalidate hash with slashes encoded as %2F', () => {
            window.location.hash = '#10%2F3.00%2F-1.00';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeFalsy();
        });

        test('invalidate hash with string values', () => {
            window.location.hash = '#4/wrongly/formed/hash';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeFalsy();
        });

        test('invalidate hash that is named, but should not be', () => {
            window.location.hash = '#map=10/3.00/-1.00&foo=bar';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeFalsy();
        });

        test('invalidate hash that has the coord as the second value, but should be first or use named params', () => {
            window.location.hash = '#foo=bar&10/3.00/-1.00';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeFalsy();
        });

        test('invalidate hash, only one value', () => {
            window.location.hash = '#24';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeFalsy();
        });

        test('invalidate hash, only two values', () => {
            window.location.hash = '#24/3.00';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeFalsy();
        });

        test('invalidate hash, zoom greater than maxZoom', () => {
            window.location.hash = '#24/3.00/-1.00';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeFalsy();
        });

        test('invalidate hash, latitude out of range', () => {
            window.location.hash = '#10/100.00/-1.00';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeFalsy();
        });

        test('invalidate hash, bearing out of range', () => {
            window.location.hash = '#10/3.00/-1.00/450';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeFalsy();

            window.location.hash = '#10/3.00/-1.00/-450';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeFalsy();
        });

        test('invalidate hash, pitch greater than maxPitch', () => {
            window.location.hash = '#10/3.00/-1.00/30/90';

            expect(hash._isValidHash(hash._getCurrentHash())).toBeFalsy();
        });
    });

    describe('initialization', () => {
        test('http://localhost/#', () => {
            window.location.href = 'http://localhost/#';
            createHash().addTo(map);
            map.setZoom(3);
            expect(window.location.hash).toBe('#3/0/0');
            expect(window.location.href).toBe('http://localhost/#3/0/0');
            map.setCenter([2.0, 1.0]);
            expect(window.location.hash).toBe('#3/1/2');
            expect(window.location.href).toBe('http://localhost/#3/1/2');
        });

        test('http://localhost/##', () => {
            window.location.href = 'http://localhost/##';
            createHash().addTo(map);
            map.setZoom(3);
            expect(window.location.hash).toBe('#3/0/0');
            expect(window.location.href).toBe('http://localhost/#3/0/0');
            map.setCenter([2.0, 1.0]);
            expect(window.location.hash).toBe('#3/1/2');
            expect(window.location.href).toBe('http://localhost/#3/1/2');
        });

        test('http://localhost#', () => {
            window.location.href = 'http://localhost#';
            createHash().addTo(map);
            map.setZoom(4);
            expect(window.location.hash).toBe('#4/0/0');
            expect(window.location.href).toBe('http://localhost/#4/0/0');
            map.setCenter([2.0, 1.0]);
            expect(window.location.hash).toBe('#4/1/2');
            expect(window.location.href).toBe('http://localhost/#4/1/2');
        });

        test('http://localhost/', () => {
            window.location.href = 'http://localhost/';
            createHash().addTo(map);
            map.setZoom(5);
            expect(window.location.hash).toBe('#5/0/0');
            expect(window.location.href).toBe('http://localhost/#5/0/0');
            map.setCenter([2.0, 1.0]);
            expect(window.location.hash).toBe('#5/1/2');
            expect(window.location.href).toBe('http://localhost/#5/1/2');
        });

        test('default value for window.location.href', () => {
            createHash().addTo(map);
            map.setZoom(5);
            expect(window.location.hash).toBe('#5/0/0');
            expect(window.location.href).toBe('http://localhost/#5/0/0');
            map.setCenter([2.0, 1.0]);
            expect(window.location.hash).toBe('#5/1/2');
            expect(window.location.href).toBe('http://localhost/#5/1/2');
        });

        test('http://localhost', () => {
            window.location.href = 'http://localhost';
            createHash().addTo(map);
            map.setZoom(4);
            expect(window.location.hash).toBe('#4/0/0');
            expect(window.location.href).toBe('http://localhost/#4/0/0');
            map.setCenter([2.0, 1.0]);
            expect(window.location.hash).toBe('#4/1/2');
            expect(window.location.href).toBe('http://localhost/#4/1/2');
        });
    });

    test('map.remove', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});

        map.remove();

    });

    test('hash with URL in other parameter does not change', () => {
        const hash = createHash('map')
            .addTo(map);

        // Set up hash with URL in another parameter
        window.location.hash = '#map=10/3/-1&returnUrl=https://example.com&filter=a&b=';
        map.setZoom(5);
        map.setCenter([1.0, 2.0]);

        expect(window.location.hash).toBe('#map=5/2/1&returnUrl=https://example.com&filter=a&b=');

        window.location.hash = '#search=foo&map=7/4/2&redirect=/path?query=value';
        hash._onHashChange();
        expect(map.getZoom()).toBe(7);
        expect(map.getCenter().lat).toBe(4);
        expect(map.getCenter().lng).toBe(2);
    });

    test('hash with URL+path in other parameter does not change', () => {
        const hash = createHash('map')
            .addTo(map);

        // Set up hash with URL in another parameter
        window.location.hash = '#map=10/3/-1&returnUrl=https://example.com/abcd/ef&filter=a&b=';
        map.setZoom(5);
        map.setCenter([1.0, 2.0]);

        expect(window.location.hash).toBe('#map=5/2/1&returnUrl=https://example.com/abcd/ef&filter=a&b=');

        window.location.hash = '#search=foo&map=7/4/2&redirect=/path?query=value';
        hash._onHashChange();
        expect(map.getZoom()).toBe(7);
        expect(map.getCenter().lat).toBe(4);
        expect(map.getCenter().lng).toBe(2);
    });

    test('hash with trailing ampersand gets removed', () => {
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#map=10/3/-1&foo=bar&';
        hash._onHashChange();
        map.setZoom(11);
        expect(window.location.hash).toBe('#map=11/3/-1&foo=bar');

    });

    test('hash with double ampersand', () => {
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#map=10/3/-1&&foo=bar';
        hash._onHashChange();
        map.setZoom(12);
        expect(window.location.hash).toBe('#map=12/3/-1&foo=bar');

    });

    test('hash with leading ampersand removes leading ampersand', () => {
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#&map=10/3/-1&foo=bar';
        hash._onHashChange();
        map.setZoom(13);
        expect(window.location.hash).toBe('#map=13/3/-1&foo=bar');
    });

    test('hash with empty parameter values should be invalid', () => {
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#map=&foo=bar';
        expect(hash._onHashChange()).toBeFalsy();

    });

    test('update to hash with empty parameter values is kept as-is', () => {
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#map=10/3/-1&empty=';
        hash._onHashChange();
        expect(map.getZoom()).toBe(10);

        map.setZoom(5);
        expect(window.location.hash).toBe('#map=5/3/-1&empty=');
    });

    describe('geographic boundary values', () => {
        let hash: Hash;

        beforeEach(() => {
            hash = createHash()
                .addTo(map);
        });

        test('Near south pole, dateline', () => {
            window.location.hash = '#10/-85.05/-180';
            hash._onHashChange();
            expect(map.getZoom()).toBe(10);

            expect(Math.abs(map.getCenter().lat)).toBeCloseTo(85.05, 1);
            expect(Math.abs(map.getCenter().lng)).toBeCloseTo(180, 2);
        });

        test('Near north pole, positive dateline', () => {
            window.location.hash = '#10/85.05/180';
            hash._onHashChange();
            expect(map.getZoom()).toBe(10);
            expect(map.getCenter().lat).toBeCloseTo(85.05, 1);
            expect(map.getCenter().lng).toBeCloseTo(180, 2);
        });

        test('Bearing at exact ±180° boundary', () => {
            window.location.hash = '#10/0/-180/180/60';
            hash._onHashChange();
            expect(Math.abs(map.getCenter().lng)).toBeCloseTo(180, 2);
            expect(map.getPitch()).toBe(60);
        });

        test('Bearing at exact -180° boundary', () => {
            map.dragRotate.enable();
            map.touchZoomRotate.enable();
            window.location.hash = '#10/0/0/-180';
            hash._onHashChange();
            expect(map.getBearing()).toBe(180);
        });

        test('Zero zoom', () => {
            window.location.hash = '#0/0/0';
            hash._onHashChange();
            expect(map.getZoom()).toBe(0);
        });
    });

    test('multiple hash instances on same page', () => {
        const container1 = window.document.createElement('div');
        Object.defineProperty(container1, 'clientWidth', {value: 512});
        Object.defineProperty(container1, 'clientHeight', {value: 512});
        const map1 = globalCreateMap({container: container1});

        const container2 = window.document.createElement('div');
        Object.defineProperty(container2, 'clientWidth', {value: 512});
        Object.defineProperty(container2, 'clientHeight', {value: 512});
        const map2 = globalCreateMap({container: container2});

        const hash1 = createHash('map1').addTo(map1);
        const hash2 = createHash('map2').addTo(map2);

        // Update first map
        map1.setZoom(5);
        map1.setCenter([1.0, 2.0]);

        expect(window.location.hash).toBe('#map1=5/2/1');

        // Update second map
        map2.setZoom(10);
        map2.setCenter([3.0, 4.0]);

        expect(window.location.hash).toBe('#map1=5/2/1&map2=10/4/3');

        // Update hash externally and verify both maps respond
        window.location.hash = '#map1=7/5/6&map2=12/7/8';

        hash1._onHashChange();
        expect(map1.getZoom()).toBe(7);
        expect(map1.getCenter().lat).toBe(5);
        expect(map1.getCenter().lng).toBe(6);

        hash2._onHashChange();
        expect(map2.getZoom()).toBe(12);
        expect(map2.getCenter().lat).toBe(7);
        expect(map2.getCenter().lng).toBe(8);

        // Clean up
        hash1.remove();
        hash2.remove();
        map1.remove();
        map2.remove();
    });
});
