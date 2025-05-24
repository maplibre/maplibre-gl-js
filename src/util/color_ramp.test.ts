import {describe, test, expect} from 'vitest';

import {renderColorRamp} from './color_ramp';
import {createPropertyExpression, type StylePropertyExpression, type StylePropertySpecification} from '@maplibre/maplibre-gl-style-spec';

const spec = {
    'function': true,
    'property-function': true,
    'type': 'color'
} as any as StylePropertySpecification;

function pixelAt(image, i) {
    return image.data.slice(i * 4, (i + 1) * 4);
}

function nearlyEquals(a, b) {
    // we're actually looking for colors that are _almost_ equal, but don't
    // expect exact equal since 256 px need to represent a range from [0, 1]
    // (inclusive) -- the first and last pixel should be exact, the halfway
    // pixel may not be
    return a.every((e, i) => Math.abs(e - b[i]) <= 3);
}

describe('renderColorRamp', () => {
    test('renderColorRamp linear', () => {

        const expression = createPropertyExpression([
            'interpolate',
            ['linear'],
            ['line-progress'],
            0, 'rgba(0,0,255,0)',
            0.25, 'white',
            0.5, 'rgba(0,255,255,0.5)',
            0.75, 'black',
            1, 'red'
        ], spec).value as StylePropertyExpression;

        const ramp = renderColorRamp({expression, evaluationKey: 'lineProgress'});

        expect(ramp.width).toBe(256);
        expect(ramp.height).toBe(1);

        expect(pixelAt(ramp, 0)[3]).toBe(0);
        expect(nearlyEquals(pixelAt(ramp, 63), [255, 255, 255, 255])).toBeTruthy();
        expect(nearlyEquals(pixelAt(ramp, 127), [0, 255, 255, 128])).toBeTruthy();
        expect(nearlyEquals(pixelAt(ramp, 191), [0, 0, 0, 255])).toBeTruthy();
        expect(nearlyEquals(pixelAt(ramp, 255), [255, 0, 0, 255])).toBeTruthy();
    });

    test('renderColorRamp step', () => {

        const expression = createPropertyExpression([
            'step',
            ['line-progress'],
            'rgba(0, 0, 255, 0.1)',
            0.1, 'red',
            0.2, 'yellow',
            0.3, 'white',
            0.5, 'black',
            1, 'black'
        ], spec).value as StylePropertyExpression;

        const ramp = renderColorRamp({expression, evaluationKey: 'lineProgress', resolution: 512});

        expect(ramp.width).toBe(512);
        expect(ramp.height).toBe(1);

        expect(pixelAt(ramp, 0)[3]).toBe(26);
        expect(nearlyEquals(pixelAt(ramp, 50), [0, 0, 255, 26])).toBeTruthy();
        expect(nearlyEquals(pixelAt(ramp, 53), [255, 0, 0, 255])).toBeTruthy();
        expect(nearlyEquals(pixelAt(ramp, 103), [255, 255, 0, 255])).toBeTruthy();
        expect(nearlyEquals(pixelAt(ramp, 160), [255, 255, 255, 255])).toBeTruthy();
        expect(nearlyEquals(pixelAt(ramp, 256), [0, 0, 0, 255])).toBeTruthy();

    });

    test('renderColorRamp usePlacement', () => {

        const expression = createPropertyExpression([
            'step',
            ['line-progress'],
            'rgba(255, 0, 0, 0.5)',
            0.1, 'black',
            0.2, 'red',
            0.3, 'blue',
            0.5, 'white',
            1, 'white'
        ], spec).value as StylePropertyExpression;

        const ramp = renderColorRamp({expression, evaluationKey: 'lineProgress', resolution: 512});

        expect(ramp.width).toBe(512);
        expect(ramp.height).toBe(1);

        renderColorRamp({expression, evaluationKey: 'lineProgress', resolution: 512, image: ramp});

        expect(pixelAt(ramp, 0)[3]).toBe(128);
        expect(nearlyEquals(pixelAt(ramp, 50), [255, 0, 0, 128])).toBeTruthy();
        expect(nearlyEquals(pixelAt(ramp, 53), [0, 0, 0, 255])).toBeTruthy();
        expect(nearlyEquals(pixelAt(ramp, 103), [255, 0, 0, 255])).toBeTruthy();
        expect(nearlyEquals(pixelAt(ramp, 160), [0, 0, 255, 255])).toBeTruthy();
        expect(nearlyEquals(pixelAt(ramp, 256), [255, 255, 255, 255])).toBeTruthy();

    });

});
