import {test, expect} from 'vitest';
import {serialize, deserialize} from './web_worker_transfer.ts';
import {featureFilter} from '@maplibre/maplibre-gl-style-spec';
import {EvaluationParameters} from '../style/evaluation_parameters.ts';

test('"has" filter returns false for undefined or missing properties after serialization', () => {
    const filter = featureFilter(['has', 'testProperty']);
    const params = new EvaluationParameters(0);

    const makeFeature = (properties: Record<string, unknown>) => ({
        type: 1 as const,
        properties: deserialize(serialize(properties)) as Record<string, unknown>,
        geometry: []
    });

    expect(filter.filter(params, makeFeature({testProperty: 'value'}))).toBe(true);
    expect(filter.filter(params, makeFeature({testProperty: undefined}))).toBe(false);
    expect(filter.filter(params, makeFeature({}))).toBe(false);
});
