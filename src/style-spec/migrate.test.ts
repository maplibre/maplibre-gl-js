import migrate from './migrate';
import * as spec from './style-spec';
import v8 from './reference/v8.json';
import validate from './validate_style';

describe('migrate', () => {
    test('does not migrate from version 5', () => {
        expect(() => {
            migrate({version: 5, layers: []});
        }).toThrow(new Error('Cannot migrate from 5'));
    });

    test('does not migrate from version 6', () => {
        expect(() => {
            migrate({version: 6, layers: []});
        }).toThrow(new Error('Cannot migrate from 6'));
    });

    test('migrates to latest version from version 7', () => {
        expect(migrate({version: 7, layers: []}).version).toEqual(spec.latest.$version);
    });

    test('converts token strings to expressions', () => {
        const migrated = migrate({
            version: 8,
            layers: [{
                id: '1',
                type: 'symbol',
                layout: {'text-field': 'a{x}', 'icon-image': '{y}'}
            }]
        });
        expect(migrated.layers[0].layout['text-field']).toEqual(['concat', 'a', ['get', 'x']]);
        expect(migrated.layers[0].layout['icon-image']).toEqual(['to-string', ['get', 'y']]);
    });

    test('converts stop functions to expressions', () => {
        const migrated = migrate({
            version: 8,
            layers: [{
                id: '1',
                type: 'background',
                paint: {
                    'background-opacity': {
                        base: 1.0,
                        stops: [[0, 1], [10, 0.72]]
                    }
                }
            }, {
                id: '2',
                type: 'background',
                paint: {
                    'background-opacity': {
                        base: 1.0,
                        stops: [[0, [1, 2]], [10, [0.72, 0.98]]]
                    }
                }
            }]
        });
        expect(migrated.layers[0].paint['background-opacity']).toEqual([
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            1,
            10,
            0.72
        ]);
        expect(migrated.layers[1].paint['background-opacity']).toEqual([
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            ['literal', [1, 2]],
            10,
            ['literal', [0.72, 0.98]]
        ]);
    });

    test('converts categorical function on resolvedImage type to valid expression', () => {
        const migrated = migrate({
            version: 8,
            sources: {
                streets: {
                    url: 'mapbox://mapbox.streets',
                    type: 'vector'
                }
            },
            layers: [{
                id: '1',
                source: 'streets',
                'source-layer': 'labels',
                type: 'symbol',
                layout: {
                    'icon-image': {
                        base: 1,
                        type: 'categorical',
                        property: 'type',
                        stops: [['park', 'some-icon']]
                    }
                }
            }]
        });
        expect(migrated.layers[0].layout['icon-image']).toEqual([
            'match',
            ['get', 'type' ],
            'park',
            'some-icon',
            ''
        ]);
        expect(validate(migrated, v8)).toEqual([]);
    });
});
