import {describe, bench, beforeAll} from 'vitest';
import {CanonicalTileID} from '../../../src/tile/tile_id';
import {EXTENT} from '../../../src/data/extent';
import {subdividePolygon} from '../../../src/render/subdivision';
import Point from '@mapbox/point-geometry';
import {coveringTiles} from '../../../src/geo/projection/covering_tiles';
import {MercatorTransform} from '../../../src/geo/projection/mercator_transform';
import {GlobeTransform} from '../../../src/geo/projection/globe_transform';
import {LngLat} from '../../../src/geo/lng_lat';
import {featureFilter as createFilter, type FilterSpecification} from '@maplibre/maplibre-gl-style-spec';
import {validateStyleMin} from '@maplibre/maplibre-gl-style-spec';
import filters from '../data/filters.json' with {type: 'json'};

/**
 * Pure computation benchmarks that require no network, canvas, or WebGL.
 * These run as part of CI to catch performance regressions early.
 *
 * Each benchmark isolates a single hot-path operation so that regressions
 * can be attributed to specific code changes. The overhead of vitest's
 * bench harness is negligible relative to the work being measured.
 */

describe('Subdivide', () => {
    let tileID: CanonicalTileID;
    let polygon: Array<Array<Point>>;
    const granularity = 64;

    function generateRing(cx: number, cy: number, radius: number, vertexCount: number): Array<Point> {
        const ring = [];
        for (let i = 0; i < vertexCount; i++) {
            const angle = i / vertexCount * 2.0 * Math.PI;
            ring.push(new Point(
                Math.round(cx + Math.cos(angle) * radius),
                Math.round(cy + Math.sin(angle) * radius)
            ));
        }
        return ring;
    }

    beforeAll(() => {
        const vertexCountMultiplier = 11;
        tileID = new CanonicalTileID(2, 1, 1);
        polygon = [];
        polygon.push(generateRing(EXTENT / 2, EXTENT / 2, EXTENT * 1.1 / 2, 81 * vertexCountMultiplier));

        function generateHole(cx: number, cy: number, r: number, vertexCount: number) {
            polygon.push(generateRing(cx * EXTENT, cy * EXTENT, r * EXTENT, vertexCount));
        }
        generateHole(0.25, 0.5, 0.15, 16 * vertexCountMultiplier);
        generateHole(0.75, 0.5, 0.15, 2 * vertexCountMultiplier);
        generateHole(0.5, 0.1, 0.05, 4 * vertexCountMultiplier);
    });

    bench('subdivide polygon with holes', () => {
        for (let i = 0; i < 10; i++) {
            subdividePolygon(polygon, tileID, granularity, true);
        }
    });
});

describe('CoveringTiles', () => {
    bench('mercator flat', () => {
        const transform = new MercatorTransform();
        transform.setCenter(new LngLat(0, 0));
        transform.setZoom(4);
        transform.resize(4096, 4096);
        transform.setMaxPitch(0);
        transform.setPitch(0);

        for (let i = 0; i < 40; i++) {
            transform.setCenter(new LngLat(i * 0.2, 0));
            coveringTiles(transform, {tileSize: 256});
        }
    });

    bench('mercator pitched at 60', () => {
        const transform = new MercatorTransform();
        transform.setCenter(new LngLat(0, 0));
        transform.setZoom(4);
        transform.resize(4096, 4096);
        transform.setMaxPitch(60);
        transform.setPitch(60);

        for (let i = 0; i < 40; i++) {
            transform.setCenter(new LngLat(i * 0.2, 0));
            coveringTiles(transform, {tileSize: 256});
        }
    });

    bench('globe flat', () => {
        const transform = new GlobeTransform();
        transform.setCenter(new LngLat(0, 0));
        transform.setZoom(4);
        transform.resize(4096, 4096);
        transform.setMaxPitch(0);
        transform.setPitch(0);

        for (let i = 0; i < 40; i++) {
            transform.setCenter(new LngLat(i * 0.2, 0));
            coveringTiles(transform, {tileSize: 256});
        }
    });

    bench('globe pitched at 60', () => {
        const transform = new GlobeTransform();
        transform.setCenter(new LngLat(0, 0));
        transform.setZoom(4);
        transform.resize(4096, 4096);
        transform.setMaxPitch(60);
        transform.setPitch(60);

        for (let i = 0; i < 40; i++) {
            transform.setCenter(new LngLat(i * 0.2, 0));
            coveringTiles(transform, {tileSize: 256});
        }
    });
});

describe('FilterCreate', () => {
    bench('create all filters from dataset', () => {
        for (const filter of filters) {
            createFilter(filter.filter as FilterSpecification);
        }
    });
});

describe('StyleValidate', () => {
    // Validate a representative style specification inline to avoid
    // requiring network access. This tests the validator's throughput
    // on a non-trivial layer set.
    const testStyle = {
        version: 8,
        name: 'benchmark-style',
        sources: {
            'openmaptiles': {
                type: 'vector',
                url: 'https://example.com/tiles.json'
            }
        },
        layers: [
            {id: 'background', type: 'background', paint: {'background-color': '#f8f4f0'}},
            {id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: {'fill-color': '#a0c8f0'}},
            {id: 'roads', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: {'line-color': '#ffffff', 'line-width': 2}},
            {id: 'buildings', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', paint: {'fill-extrusion-color': '#d4c4b0', 'fill-extrusion-height': 10}},
            {id: 'labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', layout: {'text-field': '{name}', 'text-size': 14}},
        ]
    };

    bench('validate inline style', () => {
        for (let i = 0; i < 50; i++) {
            validateStyleMin(testStyle as any);
        }
    });
});
