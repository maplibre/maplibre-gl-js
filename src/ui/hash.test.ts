import '../../stub_loader';
import {test} from '../../util/test';
import Hash from '../../../rollup/build/tsc/src/ui/hash';
import {createMap as globalCreateMap} from '../../util';

test('hash', (t) => {
    function createHash(name) {
        const hash = new Hash(name);
        hash._updateHash = hash._updateHashUnthrottled.bind(hash);
        return hash;
    }

    function createMap(t) {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});
        return globalCreateMap(t, {container});
    }

    t.test('#addTo', (t) => {
        const map = createMap(t);
        const hash = createHash();

        expect(hash._map).toBeFalsy();

        hash.addTo(map);

        expect(hash._map).toBeTruthy();
        t.end();
    });

    t.test('#remove', (t) => {
        const map = createMap(t);
        const hash = createHash()
            .addTo(map);

        expect(hash._map).toBeTruthy();

        hash.remove();

        expect(hash._map).toBeFalsy();
        t.end();
    });

    t.test('#_onHashChange', (t) => {
        const map = createMap(t);
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

        window.location.hash = '#map=10/3.00/-1.00&foo=bar';

        expect(hash._onHashChange()).toBeFalsy();

        window.location.hash = '';

        t.end();
    });

    t.test('#_onHashChange empty', (t) => {
        const map = createMap(t);
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

        t.end();
    });

    t.test('#_onHashChange named', (t) => {
        const map = createMap(t);
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

        window.location.hash = '';

        t.end();
    });

    t.test('#_getCurrentHash', (t) => {
        const map = createMap(t);
        const hash = createHash()
            .addTo(map);

        window.location.hash = '#10/3.00/-1.00';

        const currentHash = hash._getCurrentHash();

        expect(currentHash[0]).toBe('10');
        expect(currentHash[1]).toBe('3.00');
        expect(currentHash[2]).toBe('-1.00');

        window.location.hash = '';

        t.end();
    });

    t.test('#_getCurrentHash named', (t) => {
        const map = createMap(t);
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

        window.location.hash = '';

        t.end();
    });

    t.test('#_updateHash', (t) => {
        function getHash() {
            return window.location.hash.split('/');
        }

        const map = createMap(t);
        createHash()
            .addTo(map);

        expect(window.location.hash).toBeFalsy();

        map.setZoom(3);
        map.setCenter([2.0, 1.0]);

        expect(window.location.hash).toBeTruthy();

        let newHash = getHash();

        expect(newHash.length).toBe(3);
        expect(newHash[0]).toBe('#3');
        expect(newHash[1]).toBe('1');
        expect(newHash[2]).toBe('2');

        map.setPitch(60);

        newHash = getHash();

        expect(newHash.length).toBe(5);
        expect(newHash[0]).toBe('#3');
        expect(newHash[1]).toBe('1');
        expect(newHash[2]).toBe('2');
        expect(newHash[3]).toBe('0');
        expect(newHash[4]).toBe('60');

        map.setBearing(135);

        newHash = getHash();

        expect(newHash.length).toBe(5);
        expect(newHash[0]).toBe('#3');
        expect(newHash[1]).toBe('1');
        expect(newHash[2]).toBe('2');
        expect(newHash[3]).toBe('135');
        expect(newHash[4]).toBe('60');

        window.location.hash = '';

        t.end();
    });

    t.test('#_updateHash named', (t) => {
        const map = createMap(t);
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

        window.location.hash = '';

        t.end();
    });

    t.test('map#remove', (t) => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});

        const map = createMap(t, {hash: true});

        map.remove();

        expect(map).toBeTruthy();
        t.end();
    });

    t.end();
});
