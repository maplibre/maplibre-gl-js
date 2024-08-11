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
        return globalCreateMap({container}, undefined);
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

    test('#addTo', () => {
        const hash = createHash();

        expect(hash._map).toBeFalsy();

        hash.addTo(map);

        expect(hash._map).toBeTruthy();
    });

    test('#remove', () => {
        const hash = createHash()
            .addTo(map);

        expect(hash._map).toBeTruthy();

        hash.remove();

        expect(hash._map).toBeFalsy();
    });

    test('#_onHashChange', () => {
        const hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';

        hash._onHashChange();

        expect(map.getCenter().lng).toBe(-1);
        expect(map.getCenter().lat).toBe(3);
        expect(map.getZoom()).toBe(10);
        expect(map.getBearing() === 0 ? 0 : map.getBearing()).toBe(0);
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

        window.location.hash = '#map=10/3.00/-1.00&foo=bar';

        expect(hash._onHashChange()).toBeFalsy();
    });

    test('#_onHashChange empty', () => {
        const hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';

        hash._onHashChange();

        expect(map.getCenter().lng).toBe(-1);
        expect(map.getCenter().lat).toBe(3);
        expect(map.getZoom()).toBe(10);
        expect(map.getBearing() === 0 ? 0 : map.getBearing()).toBe(0);
        expect(map.getPitch()).toBe(0);

        window.location.hash = '';

        hash._onHashChange();

        expect(map.getCenter().lng).toBe(-1);
        expect(map.getCenter().lat).toBe(3);
        expect(map.getZoom()).toBe(10);
        expect(map.getBearing() === 0 ? 0 : map.getBearing()).toBe(0);
        expect(map.getPitch()).toBe(0);
    });

    test('#_onHashChange named', () => {
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#map=10/3.00/-1.00&foo=bar';

        hash._onHashChange();

        expect(map.getCenter().lng).toBe(-1);
        expect(map.getCenter().lat).toBe(3);
        expect(map.getZoom()).toBe(10);
        expect(map.getBearing() === 0 ? 0 : map.getBearing()).toBe(0);
        expect(map.getPitch()).toBe(0);

        window.location.hash = '#map&foo=bar';

        expect(hash._onHashChange()).toBeFalsy();

        window.location.hash = '#map=4/5/baz&foo=bar';

        expect(hash._onHashChange()).toBeFalsy();

        window.location.hash = '#5/1.00/0.50/30/60';

        expect(hash._onHashChange()).toBeFalsy();
    });

    test('#_getCurrentHash', () => {
        const hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';

        const currentHash = hash._getCurrentHash();

        expect(currentHash[0]).toBe('10');
        expect(currentHash[1]).toBe('3.00');
        expect(currentHash[2]).toBe('-1.00');
    });

    test('#_getCurrentHash named', () => {
        const hash = createHash('map')
            .addTo(map);

        window.location.hash = '#map=10/3.00/-1.00&foo=bar';

        let currentHash = hash._getCurrentHash();

        expect(currentHash[0]).toBe('10');
        expect(currentHash[1]).toBe('3.00');
        expect(currentHash[2]).toBe('-1.00');

        window.location.hash = '#baz&map=10/3.00/-1.00';

        currentHash = hash._getCurrentHash();

        expect(currentHash[0]).toBe('10');
        expect(currentHash[1]).toBe('3.00');
        expect(currentHash[2]).toBe('-1.00');
    });

    test('#_updateHash', () => {
        function getHash() {
            return window.location.hash.split('/');
        }

        createHash()
            .addTo(map);

        expect(window.location.hash).toBeFalsy();

        map.setZoom(3);
        map.setCenter([2.0, 1.0]);

        expect(window.location.hash).toBeTruthy();

        let newHash = getHash();

        expect(newHash).toHaveLength(3);
        expect(newHash[0]).toBe('#3');
        expect(newHash[1]).toBe('1');
        expect(newHash[2]).toBe('2');

        map.setPitch(60);

        newHash = getHash();

        expect(newHash).toHaveLength(5);
        expect(newHash[0]).toBe('#3');
        expect(newHash[1]).toBe('1');
        expect(newHash[2]).toBe('2');
        expect(newHash[3]).toBe('0');
        expect(newHash[4]).toBe('60');

        map.setBearing(135);

        newHash = getHash();

        expect(newHash).toHaveLength(5);
        expect(newHash[0]).toBe('#3');
        expect(newHash[1]).toBe('1');
        expect(newHash[2]).toBe('2');
        expect(newHash[3]).toBe('135');
        expect(newHash[4]).toBe('60');
    });

    test('#_updateHash named', () => {
        createHash('map')
            .addTo(map);

        expect(window.location.hash).toBeFalsy();

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

    test('#_removeHash', () => {
        const hash = createHash()
            .addTo(map);

        map.setZoom(3);
        map.setCenter([2.0, 1.0]);

        expect(window.location.hash).toBe('#3/1/2');

        hash._removeHash();

        expect(window.location.hash).toBe('');

        window.location.hash = '#3/1/2&foo=bar';

        hash._removeHash();

        expect(window.location.hash).toBe('#foo=bar');
    });

    test('#_removeHash named', () => {
        const hash = createHash('map')
            .addTo(map);

        map.setZoom(3);
        map.setCenter([2.0, 1.0]);

        expect(window.location.hash).toBe('#map=3/1/2');

        hash._removeHash();

        expect(window.location.hash).toBe('');

        window.location.hash = '#map=3/1/2&foo=bar';

        hash._removeHash();

        expect(window.location.hash).toBe('#foo=bar');

        window.location.hash = '#baz&map=7/2/1/135/60&foo=bar';

        hash._removeHash();

        expect(window.location.hash).toBe('#baz&foo=bar');
    });

    test('map#remove', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});

        map.remove();

        expect(map).toBeTruthy();
    });
});
