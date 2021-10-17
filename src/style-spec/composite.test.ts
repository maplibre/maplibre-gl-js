import composite from '../style-spec/composite';

describe('composites Mapbox vector sources', () => {
    const result = composite({
        'version': 7,
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

    expect(result.layers[0].source).toBe('a,b');
    expect(result.layers[1].source).toBe('a,b');
});

describe('does not composite vector + raster', () => {
    const result = composite({
        'version': 7,
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

describe('incorrect url match', () => {
    const result = composite({
        'version': 7,
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

describe('composites Mapbox vector sources with conflicting source layer names', () => {
    expect(() => {
        composite({
            'version': 7,
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
    }).toThrowError(/Conflicting source layer names/);

});
