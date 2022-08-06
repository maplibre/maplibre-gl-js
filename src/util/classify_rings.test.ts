import fs from 'fs';
import path from 'path';
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import classifyRings from './classify_rings';
import Point from '@mapbox/point-geometry';

// Load a fill feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.resolve(__dirname, '../../test/unit/assets/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.water.feature(0);

describe('classifyRings', () => {
    test('classified.length', () => {
        let geometry;
        let classified;

        geometry = [
            [
                {x: 0, y: 0},
                {x: 0, y: 40},
                {x: 40, y: 40},
                {x: 40, y: 0},
                {x: 0, y: 0}
            ]
        ];
        classified = classifyRings(geometry, undefined);
        expect(classified).toHaveLength(1);
        expect(classified[0]).toHaveLength(1);

        geometry = [
            [
                {x: 0, y: 0},
                {x: 0, y: 40},
                {x: 40, y: 40},
                {x: 40, y: 0},
                {x: 0, y: 0}
            ],
            [
                {x: 60, y: 0},
                {x: 60, y: 40},
                {x: 100, y: 40},
                {x: 100, y: 0},
                {x: 60, y: 0}
            ]
        ];
        classified = classifyRings(geometry, undefined);
        expect(classified).toHaveLength(2);
        expect(classified[0]).toHaveLength(1);
        expect(classified[1]).toHaveLength(1);

        geometry = [
            [
                {x: 0, y: 0},
                {x: 0, y: 40},
                {x: 40, y: 40},
                {x: 40, y: 0},
                {x: 0, y: 0}
            ],
            [
                {x: 10, y: 10},
                {x: 20, y: 10},
                {x: 20, y: 20},
                {x: 10, y: 10}
            ]
        ];
        classified = classifyRings(geometry, undefined);
        expect(classified).toHaveLength(1);
        expect(classified[0]).toHaveLength(2);

        geometry = feature.loadGeometry();
        classified = classifyRings(geometry, undefined);
        expect(classified).toHaveLength(2);
        expect(classified[0]).toHaveLength(1);
        expect(classified[1]).toHaveLength(10);
    });
});

describe('classifyRings + maxRings', () => {

    function createGeometry(options?) {
        const geometry = [
            // Outer ring, area = 3200
            [{x: 0, y: 0}, {x: 0, y: 40}, {x: 40, y: 40}, {x: 40, y: 0}, {x: 0, y: 0}],
            // Inner ring, area = 100
            [{x: 30, y: 30}, {x: 32, y: 30}, {x: 32, y: 32}, {x: 30, y: 30}],
            // Inner ring, area = 4
            [{x: 10, y: 10}, {x: 20, y: 10}, {x: 20, y: 20}, {x: 10, y: 10}]
        ] as Point[][];
        if (options && options.reverse) {
            geometry[0].reverse();
            geometry[1].reverse();
            geometry[2].reverse();
        }
        return geometry;
    }

    test('maxRings=undefined', () => {
        const geometry = sortRings(classifyRings(createGeometry(), undefined));
        expect(geometry).toHaveLength(1);
        expect(geometry[0]).toHaveLength(3);
        expect(geometry[0][0].area).toBe(3200);
        expect(geometry[0][1].area).toBe(100);
        expect(geometry[0][2].area).toBe(4);

    });

    test('maxRings=2', () => {
        const geometry = sortRings(classifyRings(createGeometry(), 2));
        expect(geometry).toHaveLength(1);
        expect(geometry[0]).toHaveLength(2);
        expect(geometry[0][0].area).toBe(3200);
        expect(geometry[0][1].area).toBe(100);

    });

    test('maxRings=2, reversed geometry', () => {
        const geometry = sortRings(classifyRings(createGeometry({reverse: true}), 2));
        expect(geometry).toHaveLength(1);
        expect(geometry[0]).toHaveLength(2);
        expect(geometry[0][0].area).toBe(3200);
        expect(geometry[0][1].area).toBe(100);

    });

    test('maxRings=5, geometry from fixture', () => {
        const geometry = sortRings(classifyRings(feature.loadGeometry(), 5));
        expect(geometry).toHaveLength(2);
        expect(geometry[0]).toHaveLength(1);
        expect(geometry[1]).toHaveLength(5);

        const areas = geometry[1].map((ring) => { return ring.area; });
        expect(areas).toEqual([2763951, 21600, 8298, 4758, 3411]);

    });

});

function sortRings(geometry) {
    for (let i = 0; i < geometry.length; i++) {
        geometry[i] = geometry[i].sort(compareAreas);
    }
    return geometry;
}

function compareAreas(a, b) {
    return b.area - a.area;
}
