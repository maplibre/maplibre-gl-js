import {derefLayers, type LayerWithRef} from './deref';
import {describe, test, expect} from 'vitest';

describe('deref', () => {
    test('derefs a ref layer which follows its parent', () => {
        expect(derefLayers([
            {
                'id': 'parent',
                'type': 'line'
            } as LayerWithRef,
            {
                'id': 'child',
                'ref': 'parent'
            } as LayerWithRef
        ])).toEqual([
            {
                'id': 'parent',
                'type': 'line'
            },
            {
                'id': 'child',
                'type': 'line'
            }
        ]);
    });

    test('derefs a ref layer which precedes its parent', () => {
        expect(derefLayers([
            {
                'id': 'child',
                'ref': 'parent'
            } as LayerWithRef,
            {
                'id': 'parent',
                'type': 'line'
            } as LayerWithRef
        ])).toEqual([
            {
                'id': 'child',
                'type': 'line'
            },
            {
                'id': 'parent',
                'type': 'line'
            }
        ]);
    });
});
