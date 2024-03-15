import {subdivideFill} from '../../../src/render/subdivision';
import {CanonicalTileID} from '../../../src/source/tile_id';
import Benchmark from '../lib/benchmark';
import {EXTENT} from '../../../src/data/extent';

export default class Subdivide extends Benchmark {
    flattened: Array<number>;
    holeIndices: Array<number>;
    lineList: Array<Array<number>>;
    tileID: CanonicalTileID;
    granularity: number;

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

        const vertices = [];
        const holeIndices = [];
        const lineList = [];

        lineList.push(generateRing(EXTENT / 2, EXTENT / 2, EXTENT * 1.1 / 2, 81 * vertexCountMultiplier, vertices));

        // this function takes arguments in range 0..1, where 0 maps to 0 and 1 to EXTENT
        // this makes placing holes by hand easier
        function generateHole(cx: number, cy: number, r: number, vertexCount: number) {
            holeIndices.push(vertices.length / 2);
            lineList.push(generateRing(cx * EXTENT, cy * EXTENT, r * EXTENT, vertexCount, vertices));
        }

        generateHole(0.25, 0.5, 0.15, 16 * vertexCountMultiplier);
        generateHole(0.75, 0.5, 0.15, 2 * vertexCountMultiplier);
        generateHole(0.5, 0.1, 0.05, 4 * vertexCountMultiplier);

        this.flattened = vertices;
        this.holeIndices = holeIndices;
        this.lineList = lineList;
    }

    async bench() {
        subdivideFill(this.flattened, this.holeIndices, this.lineList, this.tileID, this.granularity);
    }
}

// Returns line indices for this ring
function generateRing(cx: number, cy: number, radius: number, vertexCount: number, target: Array<number>): Array<number> {
    const lineIndices = [];
    const baseVertex = target.length / 2;

    for (let i = 0; i < vertexCount; i++) {
        const angle = i / vertexCount * 2.0 * Math.PI;
        // round to emulate integer vertex coordinates
        target.push(Math.round(cx + Math.cos(angle) * radius));
        target.push(Math.round(cy + Math.sin(angle) * radius));

        lineIndices.push(i + baseVertex);
        lineIndices.push(((i + 1) % vertexCount) + baseVertex);
    }

    return lineIndices;
}
