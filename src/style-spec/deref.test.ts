import deref from './deref';

describe('deref', () => {
    test('derefs a ref layer which follows its parent', () => {
        expect(deref([
            {
                'id': 'parent',
                'type': 'line'
            },
            {
                'id': 'child',
                'ref': 'parent'
            }
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
        expect(deref([
            {
                'id': 'child',
                'ref': 'parent'
            },
            {
                'id': 'parent',
                'type': 'line'
            }
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
