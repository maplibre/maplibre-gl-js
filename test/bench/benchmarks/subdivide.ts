import {CanonicalTileID} from '../../../src/source/tile_id';
import Benchmark from '../lib/benchmark';
import {EXTENT} from '../../../src/data/extent';
import {subdividePolygon} from '../../../src/render/subdivision';
import Point from '@mapbox/point-geometry';

export default class Subdivide extends Benchmark {
    tileID: CanonicalTileID;
    granularity: number;
    polygon: Array<Array<Point>>;

    async setup(): Promise<void> {
        await super.setup();

        // Reasonably fast benchmark parameters:
        // vertexCountMultiplier = 11
        // granularity = 64

        const vertexCountMultiplier = 11;
        this.granularity = 64;

        // Use web mercator base tile, as it borders both north and south poles,
        // so we also benchmark pole geometry generation.
        this.tileID = new CanonicalTileID(2, 1, 1); // tile avoids north and south mercator edges

        const polygon = [];

        polygon.push(generateRing(EXTENT / 2, EXTENT / 2, EXTENT * 1.1 / 2, 81 * vertexCountMultiplier));

        // this function takes arguments in range 0..1, where 0 maps to 0 and 1 to EXTENT
        // this makes placing holes by hand easier
        function generateHole(cx: number, cy: number, r: number, vertexCount: number) {
            polygon.push(generateRing(cx * EXTENT, cy * EXTENT, r * EXTENT, vertexCount));
        }

        generateHole(0.25, 0.5, 0.15, 16 * vertexCountMultiplier);
        generateHole(0.75, 0.5, 0.15, 2 * vertexCountMultiplier);
        generateHole(0.5, 0.1, 0.05, 4 * vertexCountMultiplier);

        this.polygon = polygon;
    }

    bench() {
        for (let i = 0; i < 10; i++) {
            subdividePolygon(this.polygon, this.tileID, this.granularity, true);
        }
    }
}

function generateRing(cx: number, cy: number, radius: number, vertexCount: number): Array<Point> {
    const ring = [];

    for (let i = 0; i < vertexCount; i++) {
        const angle = i / vertexCount * 2.0 * Math.PI;
        // round to emulate integer vertex coordinates
        ring.push(new Point(
            Math.round(cx + Math.cos(angle) * radius),
            Math.round(cy + Math.sin(angle) * radius)
        ));
    }

    return ring;
}
