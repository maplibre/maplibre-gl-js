import {bench} from 'vitest';
import Point from '@mapbox/point-geometry';
import {CanonicalTileID} from '../tile/tile_id.ts';
import {EXTENT} from '../data/extent.ts';
import {subdividePolygon} from './subdivision.ts';

function generateRing(cx: number, cy: number, radius: number, vertexCount: number): Point[] {
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

const vertexCountMultiplier = 11;
const granularity = 64;
const tileID = new CanonicalTileID(2, 1, 1);

const polygon: Point[][] = [generateRing(EXTENT / 2, EXTENT / 2, EXTENT * 1.1 / 2, 81 * vertexCountMultiplier)];

function generateHole(cx: number, cy: number, r: number, vertexCount: number) {
    polygon.push(generateRing(cx * EXTENT, cy * EXTENT, r * EXTENT, vertexCount));
}

generateHole(0.25, 0.5, 0.15, 16 * vertexCountMultiplier);
generateHole(0.75, 0.5, 0.15, 2 * vertexCountMultiplier);
generateHole(0.5, 0.1, 0.05, 4 * vertexCountMultiplier);

bench('subdividePolygon', () => {
    for (let i = 0; i < 10; i++) {
        subdividePolygon(polygon, tileID, granularity, true);
    }
});
