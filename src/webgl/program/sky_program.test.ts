import {describe, expect, test} from 'vitest';
import {skyUniformValues} from './sky_program.ts';
import {Sky} from '../../style/sky.ts';
import {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import {MercatorTransform} from '../../geo/projection/mercator_transform.ts';

function createSky(): Sky {
    const sky = new Sky({}, {});
    sky.recalculate(new EvaluationParameters(0));
    return sky;
}

function createTransform(): MercatorTransform {
    const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: false});
    transform.resize(512, 512);
    transform.setPitch(60);
    return transform;
}

describe('skyUniformValues', () => {
    test('places the horizon at the padded center of the viewport when padding is set', () => {
        const sky = createSky();
        const unpadded = skyUniformValues(sky, createTransform(), 1)['u_horizon'] as [number, number];

        const transform = createTransform();
        transform.setPadding({top: 100, bottom: 0, left: 0, right: 0});
        const padded = skyUniformValues(sky, transform, 1)['u_horizon'] as [number, number];

        // Padding moves the viewport center 50 CSS pixels down, so the sky horizon
        // must move with the map's horizon instead of staying at the raw center.
        expect(padded[0]).toBeCloseTo(unpadded[0], 10);
        expect(padded[1]).toBeCloseTo(unpadded[1] + 50, 10);
    });
});
