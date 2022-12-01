import composite from './composite';
import {LineLayerSpecification} from './types.g';

describe('composite', () => {
    test('composites Mapbox vector sources', () => {
        const result = composite({
            'version': 7 as any,
            'sources': {
                'mapbox-a': {
                    'type': 'vector',
                    'url': 'mapbox://a'
                },
                'mapbox-b': {
                    'type': 'vector',
                    'url': 'mapbox://b'
                }
            },
            'layers': [{
                'id': 'a',
                'type': 'line',
                'source': 'mapbox-a'
            }, {
                'id': 'b',
                'type': 'line',
                'source': 'mapbox-b'
            }]
        });

        expect(result.sources).toEqual({
            'a,b': {
                'type': 'vector',
                'url': 'mapbox://a,b'
            }
        });

        expect((result.layers[0] as LineLayerSpecification).source).toBe('a,b');
        expect((result.layers[1] as LineLayerSpecification).source).toBe('a,b');
    });

    test('does not composite vector + raster', () => {
        const result = composite({
            'version': 7 as any,
            'sources': {
                'a': {
                    'type': 'vector',
                    'url': 'mapbox://a'
                },
                'b': {
                    'type': 'raster',
                    'url': 'mapbox://b'
                }
            },
            'layers': []
        });

        expect(Object.keys(result.sources)).toEqual(['a', 'b']);
    });

    test('incorrect url match', () => {
        const result = composite({
            'version': 7 as any,
            'sources': {
                'a': {
                    'type': 'vector',
                    'url': 'mapbox://a'
                },
                'b': {
                    'type': 'vector',
                    'url': ''
                }
            },
            'layers': []
        });

        expect(Object.keys(result.sources)).toEqual(['a', 'b']);
    });

    test('composites Mapbox vector sources with conflicting source layer names', () => {
        expect(() => {
            composite({
                'version': 7 as any,
                'sources': {
                    'mapbox-a': {
                        'type': 'vector',
                        'url': 'mapbox://a'
                    },
                    'mapbox-b': {
                        'type': 'vector',
                        'url': 'mapbox://b'
                    }
                },
                'layers': [{
                    'id': 'a',
                    'type': 'line',
                    'source-layer': 'sourcelayer',
                    'source': 'mapbox-a'
                }, {
                    'id': 'b',
                    'type': 'line',
                    'source-layer': 'sourcelayer',
                    'source': 'mapbox-b'
                }]
            });
        }).toThrow(/Conflicting source layer names/);

    });
});
