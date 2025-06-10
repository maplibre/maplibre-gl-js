import {describe, beforeEach, test, expect} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import { on } from 'events';
import { off } from 'process';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('#getAllowUnderzoom', () => {
    test('default false', () => {
        const map = createMap({});
        expect(map.getAllowUnderzoom()).toBe(false);
    });

    test('initially false', () => {
        const map = createMap({allowUnderzoom: false});
        expect(map.getAllowUnderzoom()).toBe(false);
    });

    test('initially true', () => {
        const map = createMap({allowUnderzoom: true});
        expect(map.getAllowUnderzoom()).toBe(true);
    });
});

describe('#setAllowUnderzoom', () => {
    test('set true', () => {
        const map = createMap({allowUnderzoom: false});
        map.setAllowUnderzoom(true);
        expect(map.getAllowUnderzoom()).toBe(true);
    });

    test('set false', () => {
        const map = createMap({allowUnderzoom: true});
        map.setAllowUnderzoom(false);
        expect(map.getAllowUnderzoom()).toBe(false);
    });

    test('set undefined is false', () => {
        const map = createMap({allowUnderzoom: true});
        map.setAllowUnderzoom(undefined);
        expect(map.getAllowUnderzoom()).toBe(false);
    });

    test('set null is false', () => {
        const map = createMap({allowUnderzoom: true});
        map.setAllowUnderzoom(null);
        expect(map.getAllowUnderzoom()).toBe(false);
    });
});

describe('#getUnderzoom', () => {
    test('default 80', () => {
        const map = createMap({});
        expect(map.getUnderzoom()).toBe(80);
    });

    test('initially 90', () => {
        const map = createMap({underzoom: 90});
        expect(map.getUnderzoom()).toBe(90);
    });
});

describe('#setUnderzoom', () => {
    test('set 90', () => {
        const map = createMap({});
        map.setUnderzoom(90);
        expect(map.getUnderzoom()).toBe(90);
    });
});

describe('#getOverpan', () => {
    test('default 0', () => {
        const map = createMap({});
        expect(map.getOverpan()).toBe(0);
    });

    test('initially 25', () => {
        const map = createMap({underzoom: 25});
        expect(map.getUnderzoom()).toBe(25);
    });
});

describe('#setOverpan', () => {
    test('set 25', () => {
        const map = createMap({});
        map.setOverpan(25);
        expect(map.getOverpan()).toBe(25);
    });
});

describe('#allowUnderzoom', () => {
    test('constrains zoom out because default false', () => {
        const map = createMap({renderWorldCopies: false});
        map.setZoom(-1.5);
        expect(map.getZoom()).toBeCloseTo(-1.3561438102244738);
    });

    test('zooms in to constrained zoom when set false while underzoomed', () => {
        const map = createMap({renderWorldCopies: false, allowUnderzoom: true, underzoom: 0});
        map.setZoom(-1.5);
        expect(map.getZoom()).toBeCloseTo(-1.5);
        map.setAllowUnderzoom(false);
        expect(map.getZoom()).toBeCloseTo(-1.3561438102244738);
    });

    test('constrains horizontal panning because default false', () => {
        const map = createMap({renderWorldCopies: false});
        map.setCenter({lng: 180, lat: 0});
        expect(map.getCenter().lng).toBeCloseTo(110, 0);
    });
    
    test('constrains horizontal panning when true because default overpan=0', () => {
        const map = createMap({renderWorldCopies: false, allowUnderzoom: true});
        map.setCenter({lng: 180, lat: 0});
        expect(map.getCenter().lng).toBeCloseTo(110, 0);
    });

    test('constrains vertical panning because default false', () => {
        const map = createMap({renderWorldCopies: false});
        map.setCenter({lng: 0, lat: 90});
        expect(map.getCenter().lat).toBeCloseTo(73.226700429668, 0);
    });

    test('constrains vertical panning when true because default overpan=0', () => {
        const map = createMap({renderWorldCopies: false, allowUnderzoom: true});
        map.setCenter({lng: 0, lat: 90});
        expect(map.getCenter().lat).toBeCloseTo(73.226700429668, 0);
    });

    test('pans horizontally to constrained bounds when set false while overpanned', () => {
        const map = createMap({renderWorldCopies: false, allowUnderzoom: true, overpan: 50});
        map.setCenter({lng: 180, lat: 0});
        expect(map.getCenter().lng).toBeCloseTo(180, 0);
        map.setAllowUnderzoom(false);
        expect(map.getCenter().lng).toBeCloseTo(110, 0);
    });

    test('pans vertically to constrained bounds when set false while overpanned', () => {
        const map = createMap({renderWorldCopies: false, allowUnderzoom: true, overpan: 50});
        map.setCenter({lng: 0, lat: 90});
        expect(map.getCenter().lat).toBeCloseTo(90, 0);
        map.setAllowUnderzoom(false);
        expect(map.getCenter().lat).toBeCloseTo(73.226700429668, 0);
    });
})

describe('#underzoom', () => {
    test('constrains zoom out to viewport with highest allowed underzoom', () => {
        const map = createMap({renderWorldCopies: false, allowUnderzoom: true, underzoom: 100});
        map.setZoom(-1.5);
        expect(map.getZoom()).toBeCloseTo(-1.3561438306832663);
    });
    test('not constrained in zoom out with lowest allowed underzoom', () => {
        const map = createMap({renderWorldCopies: false, allowUnderzoom: true, underzoom: 0});
        map.setZoom(-1.5);
        expect(map.getZoom()).toBeCloseTo(-1.5);
    });
    test('respects minZoom despite lowest allowed underzoom', () => {
        const map = createMap({renderWorldCopies: false, allowUnderzoom: true, underzoom: 0});
        map.setMinZoom(4);
        map.setZoom(-Infinity);
        expect(map.getZoom()).toBeCloseTo(4);
    });
})

describe('#overpan', () => {
    test('not constrained in horizontal panning with highest allowed overpan', () => {
        const map = createMap({renderWorldCopies: false, allowUnderzoom: true, overpan: 50});
        map.setCenter({lng: 180, lat: 0});
        expect(map.getCenter().lng).toBeCloseTo(180, 0);
    });

    test('not constrained in vertical panning with highest allowed overpan', () => {
        const map = createMap({renderWorldCopies: false, allowUnderzoom: true, overpan: 50});
        map.setCenter({lng: 0, lat: 90})
        expect(map.getCenter().lat).toBeCloseTo(90, 0);
    });
})
