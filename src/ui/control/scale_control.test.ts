
import {test} from '../../../util/test';
import {createMap} from '../../../util';
import ScaleControl from '../../ui/control/scale_control';

describe('ScaleControl appears in bottom-left by default', () => {
    const map = createMap(t);
    map.addControl(new ScaleControl());

    expect(
        map.getContainer().querySelectorAll('.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale').length
    ).toBe(1);
});

describe('ScaleControl appears in the position specified by the position option', () => {
    const map = createMap(t);
    map.addControl(new ScaleControl(), 'top-left');

    expect(
        map.getContainer().querySelectorAll('.maplibregl-ctrl-top-left .maplibregl-ctrl-scale').length
    ).toBe(1);
});

describe('ScaleControl should change unit of distance after calling setUnit', () => {
    const map = createMap(t);
    const scale = new ScaleControl();
    const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
    map.addControl(scale);

    let contents = map.getContainer().querySelector(selector).innerHTML;
    t.match(contents, /km/);

    scale.setUnit('imperial');
    contents = map.getContainer().querySelector(selector).innerHTML;
    t.match(contents, /mi/);
});

describe('ScaleControl should respect the maxWidth regardless of the unit and actual scale', () => {
    const map = createMap(t);
    const maxWidth = 100;
    const scale = new ScaleControl({maxWidth, unit: 'nautical'});
    const selector = '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale';
    map.addControl(scale);
    map.setZoom(12.5);

    const el = map.getContainer().querySelector(selector);
    expect(parseFloat(el.style.width, 10) <= maxWidth).toBeTruthy();
});
