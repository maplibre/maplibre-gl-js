import migrate from './v9';

describe('migrate v9', () => {
    test('deref layers', () => {
        const input = {
            version: 8,
            sources: {
                a: {type: 'vector', tiles: ['http://dev/null']}
            },
            layers: [{
                id: 'parent',
                source: 'a',
                'source-layer': 'x',
                type: 'fill'
            }, {
                id: 'child',
                ref: 'parent'
            }]
        } as any;

        expect(migrate(input)).toEqual({
            version: 9,
            sources: {
                a: {type: 'vector', tiles: ['http://dev/null']}
            },
            layers: [{
                id: 'parent',
                source: 'a',
                'source-layer': 'x',
                type: 'fill'
            }, {
                id: 'child',
                source: 'a',
                'source-layer': 'x',
                type: 'fill'
            }]
        });

    });

    test('declass style', () => {
        const input = {
            version: 8,
            sources: {
                a: {type: 'vector', tiles: ['http://dev/null']}
            },
            layers: [{
                id: 'a',
                source: 'a',
                type: 'fill',
                paint: {},
                'paint.right': {
                    'fill-color': 'red'
                },
                'paint.left': {
                    'fill-color': 'blue'
                }
            }]
        } as any;

        expect(migrate(input)).toEqual({
            version: 9,
            sources: {
                a: {type: 'vector', tiles: ['http://dev/null']}
            },
            layers: [{
                id: 'a',
                source: 'a',
                type: 'fill',
                paint: {}
            }]
        });

    });

});
