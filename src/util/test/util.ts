import '../stub_loader';
import Map from '../../rollup/build/tsc/src/ui/map';
import {extend} from '../../rollup/build/tsc/src/util/util';

export function createMap(t, options, callback) {
    const container = window.document.createElement('div');
    const defaultOptions = {
        container,
        interactive: false,
        attributionControl: false,
        trackResize: true,
        style: {
            "version": 8,
            "sources": {},
            "layers": []
        }
    };

    Object.defineProperty(container, 'clientWidth', {value: 200, configurable: true});
    Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});

    if (options && options.deleteStyle) delete defaultOptions.style;

    const map = new Map(extend(defaultOptions, options));
    if (callback) map.on('load', () => {
        callback(null, map);
    });

    return map;
}

export function equalWithPrecision(test, expected, actual, multiplier, message, extra) {
    message = message || `should be equal to within ${multiplier}`;
    const expectedRounded = Math.round(expected / multiplier) * multiplier;
    const actualRounded = Math.round(actual / multiplier) * multiplier;

    return test.equal(expectedRounded, actualRounded, message, extra);
}
