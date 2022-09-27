import migrate from './v8';

describe('migrate v8', () => {
    test('split text-font', () => {
        const input = {
            'version': 7,
            'sources': {
                'vector': {
                    'type': 'vector', 'url': 'http://www.example.com/example.json'
                }
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'symbol',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'text-font': 'Helvetica, Arial',
                        'text-field': '{foo}'
                    }
                }
            ]
        } as any;

        const output = {
            'version': 8,
            'sources': {
                'vector': {
                    'type': 'vector', 'url': 'http://www.example.com/example.json'
                }
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'symbol',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'text-font': ['Helvetica', 'Arial'],
                        'text-field': '{foo}'
                    }
                }
            ]
        };

        expect(migrate(input)).toEqual(output);
    });

    test('rename symbol-min-distance', () => {
        const input = {
            'version': 7,
            'sources': {
                'vector': {
                    'type': 'vector', 'url': 'http://www.example.com/example.json'
                }
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'symbol',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'symbol-min-distance': 2
                    }
                }
            ]
        } as any;

        const output = {
            'version': 8,
            'sources': {
                'vector': {
                    'type': 'vector', 'url': 'http://www.example.com/example.json'
                }
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'symbol',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'symbol-spacing': 2
                    }
                }
            ]
        };

        expect(migrate(input)).toEqual(output);
    });

    test('renames urls', () => {
        const input = {
            'version': 7,
            'sources': {
                'vector': {
                    'type': 'video', 'url': ['foo'],
                    coordinates: [[1, 0], [1, 0], [1, 0], [1, 0]]
                }
            },
            'layers': []
        } as any;

        const output = {
            'version': 8,
            'sources': {
                'vector': {
                    'type': 'video', 'urls': ['foo'],
                    coordinates: [[0, 1], [0, 1], [0, 1], [0, 1]]
                }
            },
            'layers': []
        };

        expect(migrate(input)).toEqual(output);
    });

    test('not migrate interpolated functions', () => {
        const input = {
            'version': 7,
            'sources': {
                'vector': {
                    'type': 'vector',
                    'url': 'http://www.example.com/example.json'
                }
            },
            'layers': [{
                'id': 'functions',
                'type': 'symbol',
                'source': 'vector',
                'source-layer': 'layer',
                'layout': {
                    'line-width': {
                        base: 2,
                        stops: [[1, 2], [3, 6]]
                    }
                }
            }]
        } as any;

        const output = {
            'version': 8,
            'sources': {
                'vector': {
                    'type': 'vector',
                    'url': 'http://www.example.com/example.json'
                }
            },
            'layers': [{
                'id': 'functions',
                'type': 'symbol',
                'source': 'vector',
                'source-layer': 'layer',
                'layout': {
                    'line-width': {
                        base: 2,
                        stops: [[1, 2], [3, 6]]
                    }
                }
            }]
        };

        expect(migrate(input)).toEqual(output);
    });

    test('not migrate piecewise-constant functions', () => {
        const input = {
            'version': 7,
            'sources': {
                'vector': {
                    'type': 'vector',
                    'url': 'http://www.example.com/example.json'
                }
            },
            'layers': [{
                'id': 'functions',
                'type': 'symbol',
                'source': 'vector',
                'source-layer': 'layer',
                'layout': {
                    'text-transform': {
                        stops: [[1, 'uppercase'], [3, 'lowercase']],
                    }
                }
            }]
        } as any;

        const output = {
            'version': 8,
            'sources': {
                'vector': {
                    'type': 'vector',
                    'url': 'http://www.example.com/example.json'
                }
            },
            'layers': [{
                'id': 'functions',
                'type': 'symbol',
                'source': 'vector',
                'source-layer': 'layer',
                'layout': {
                    'text-transform': {
                        stops: [[1, 'uppercase'], [3, 'lowercase']],
                    }
                }
            }]
        };

        expect(migrate(input)).toEqual(output);
    });

    test('inline constants', () => {
        const input = {
            'version': 7,
            'constants': {
                '@foo': 0.5
            },
            'sources': {
                'vector': {'type': 'vector', 'url': 'http://www.example.com/example.json'}
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'fill',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'fill-opacity': '@foo'
                    }
                }
            ]
        } as any;

        const output = {
            'version': 8,
            'sources': {
                'vector': {'type': 'vector', 'url': 'http://www.example.com/example.json'}
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'fill',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'fill-opacity': 0.5
                    }
                }
            ]
        };

        expect(migrate(input)).toEqual(output);
    });

    test('migrate and inline fontstack constants', () => {
        const input = {
            'version': 7,
            'constants': {
                '@foo': 'Arial Unicode,Foo Bar'
            },
            'sources': {
                'vector': {'type': 'vector', 'url': 'http://www.example.com/example.json'}
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'symbol',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'text-font': '@foo'
                    }
                }
            ]
        } as any;

        const output = {
            'version': 8,
            'sources': {
                'vector': {'type': 'vector', 'url': 'http://www.example.com/example.json'}
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'symbol',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'text-font': ['Arial Unicode', 'Foo Bar']
                    }
                }
            ]
        };

        expect(migrate(input)).toEqual(output);
    });

    test('update fontstack function', () => {
        const input = {
            'version': 7,
            'sources': {
                'vector': {'type': 'vector', 'url': 'http://www.example.com/example.json'}
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'symbol',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'text-font': {
                            'base': 1,
                            'stops': [
                                [
                                    0,
                                    'Open Sans Regular, Arial Unicode MS Regular'
                                ],
                                [
                                    6,
                                    'Open Sans Semibold, Arial Unicode MS Regular'
                                ]
                            ]
                        }
                    }
                }
            ]
        } as any;

        const output = {
            'version': 8,
            'sources': {
                'vector': {'type': 'vector', 'url': 'http://www.example.com/example.json'}
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'symbol',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'text-font': {
                            'base': 1,
                            'stops': [
                                [0, ['Open Sans Regular', 'Arial Unicode MS Regular']],
                                [6, ['Open Sans Semibold', 'Arial Unicode MS Regular']]
                            ]
                        }
                    }
                }
            ]
        };

        expect(migrate(input)).toEqual(output);
    });

    test('inline and migrate fontstack constant function', () => {
        const input = {
            'version': 7,
            'constants': {
                '@function': {
                    'base': 1,
                    'stops': [
                        [
                            0,
                            'Open Sans Regular, Arial Unicode MS Regular'
                        ],
                        [
                            6,
                            'Open Sans Semibold, Arial Unicode MS Regular'
                        ]
                    ]
                }
            },
            'sources': {
                'vector': {'type': 'vector', 'url': 'http://www.example.com/example.json'}
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'symbol',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'text-font': '@function'
                    }
                }
            ]
        } as any;

        const output = {
            'version': 8,
            'sources': {
                'vector': {'type': 'vector', 'url': 'http://www.example.com/example.json'}
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'symbol',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'text-font': {
                            'base': 1,
                            'stops': [
                                [0, ['Open Sans Regular', 'Arial Unicode MS Regular']],
                                [6, ['Open Sans Semibold', 'Arial Unicode MS Regular']]
                            ]
                        }
                    }
                }
            ]
        };

        expect(migrate(input)).toEqual(output);
    });

    test('update fontstack function constant', () => {
        const input = {
            'version': 7,
            'constants': {
                '@font-stack-a': 'Open Sans Regular, Arial Unicode MS Regular',
                '@font-stack-b': 'Open Sans Semibold, Arial Unicode MS Regular'
            },
            'sources': {
                'vector': {'type': 'vector', 'url': 'http://www.example.com/example.json'}
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'symbol',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'text-font': {
                            'base': 1,
                            'stops': [
                                [0, '@font-stack-a'],
                                [6, '@font-stack-b']
                            ]
                        }
                    }
                }
            ]
        } as any;

        const output = {
            'version': 8,
            'sources': {
                'vector': {'type': 'vector', 'url': 'http://www.example.com/example.json'}
            },
            'layers': [
                {
                    'id': 'minimum',
                    'type': 'symbol',
                    'source': 'vector',
                    'source-layer': 'layer',
                    'layout': {
                        'text-font': {
                            'base': 1,
                            'stops': [
                                [0, ['Open Sans Regular', 'Arial Unicode MS Regular']],
                                [6, ['Open Sans Semibold', 'Arial Unicode MS Regular']]
                            ]
                        }
                    }
                }
            ]
        };

        expect(migrate(input)).toEqual(output);
    });

    test('migrate UNversioned fontstack urls', () => {
        const input = {
            'version': 7,
            'glyphs': 'mapbox://fontstack/{fontstack}/{range}.pbf',
            'layers': []
        } as any;

        const output = {
            'version': 8,
            'glyphs': 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
            'layers': []
        };

        expect(migrate(input)).toEqual(output);
    });

    test('migrate versioned fontstack urls', () => {
        const input = {
            'version': 7,
            'glyphs': 'mapbox://fonts/v1/boxmap/{fontstack}/{range}.pbf',
            'layers': []
        } as any;

        const output = {
            'version': 8,
            'glyphs': 'mapbox://fonts/boxmap/{fontstack}/{range}.pbf',
            'layers': []
        };

        expect(migrate(input)).toEqual(output);
    });

});
