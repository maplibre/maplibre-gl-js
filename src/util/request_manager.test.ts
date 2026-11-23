import {describe, expect, test, vi} from 'vitest';
import {RequestManager, type ResourceType, type RequestTransformFunction} from './request_manager.ts';

const resourceTypes: ResourceType[] = [
    'Glyphs',
    'Image',
    'Source',
    'SpriteImage',
    'SpriteJSON',
    'Style',
    'Tile',
    'Unknown',
];

describe('ResourceType', () => {
    test('is a string literal union that can be used without an enum object', () => {
        // Importing `ResourceType` is type-only, so callers spell the values out as
        // plain strings instead of reaching for `ResourceType.SomeMember`.
        expect(resourceTypes).toHaveLength(8);
        expect(new Set(resourceTypes).size).toBe(resourceTypes.length);
    });

    test('values are forwarded to the transform function as-is', async () => {
        const transform = vi.fn<RequestTransformFunction>(() => undefined);
        const requestManager = new RequestManager(transform);

        for (const resourceType of resourceTypes) {
            await requestManager.transformRequest('http://example.com/resource', resourceType);
        }

        expect(transform.mock.calls.map(([, resourceType]) => resourceType)).toEqual(resourceTypes);
    });
});
