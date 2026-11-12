import {describe, test, expect} from 'vitest';
import {SubdivisionGranularityExpression} from './subdivision_granularity_settings.ts';

describe('SubdivisionGranularityExpression', () => {
    test('keeps at least the surface granularity, which halves every second zoom level', () => {
        const expression = new SubdivisionGranularityExpression(128, 2, 64);
        expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(z => expression.getGranularityForZoomLevel(z)))
            .toEqual([128, 64, 32, 32, 16, 16, 8, 8, 4, 4, 2, 2, 2]);
    });
});
