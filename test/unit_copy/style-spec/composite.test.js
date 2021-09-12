import {test} from '../../util/test';
import composite from '../../../rollup/build/tsc/style-spec/composite';

test('composites Mapbox vector sources', (t) => {
    const result = composite({
        "version": 7,
        "sources": {
            "mapbox-a": {
                "type": "vector",
                "url": "mapbox://a"
            },
            "mapbox-b": {
                "type": "vector",
                "url": "mapbox://b"
            }
        },
        "layers": [{
            "id": "a",
            "type": "line",
            "source": "mapbox-a"
        }, {
            "id": "b",
            "type": "line",
            "source": "mapbox-b"
        }]
    });

    expect(result.sources).toEqual({
        "a,b": {
            "type": "vector",
            "url": "mapbox://a,b"
        }
    });

    expect(result.layers[0].source).toBe("a,b");
    expect(result.layers[1].source).toBe("a,b");
    t.end();
});

test('does not composite vector + raster', (t) => {
    const result = composite({
        "version": 7,
        "sources": {
            "a": {
                "type": "vector",
                "url": "mapbox://a"
            },
            "b": {
                "type": "raster",
                "url": "mapbox://b"
            }
        },
        "layers": []
    });

    expect(Object.keys(result.sources)).toEqual(["a", "b"]);
    t.end();
});

test('incorrect url match', (t) => {
    const result = composite({
        "version": 7,
        "sources": {
            "a": {
                "type": "vector",
                "url": "mapbox://a"
            },
            "b": {
                "type": "vector",
                "url": ""
            }
        },
        "layers": []
    });

    expect(Object.keys(result.sources)).toEqual(["a", "b"]);
    t.end();
});

test('composites Mapbox vector sources with conflicting source layer names', (t) => {
    expect(() => {
        composite({
            "version": 7,
            "sources": {
                "mapbox-a": {
                    "type": "vector",
                    "url": "mapbox://a"
                },
                "mapbox-b": {
                    "type": "vector",
                    "url": "mapbox://b"
                }
            },
            "layers": [{
                "id": "a",
                "type": "line",
                "source-layer": "sourcelayer",
                "source": "mapbox-a"
            }, {
                "id": "b",
                "type": "line",
                "source-layer": "sourcelayer",
                "source": "mapbox-b"
            }]
        });
    }).toThrowError(/Conflicting source layer names/);

    t.end();
});
