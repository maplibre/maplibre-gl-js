import {CanonicalTileID} from '../../../src/tile/tile_id.ts';
import Benchmark from '../lib/benchmark.ts';
import {EXTENT} from '../../../src/data/extent.ts';
import {roundPolygonCorners} from '../../../src/data/bucket/round_polygon_corners.ts';
import Point from '@mapbox/point-geometry';

/**
 * Benchmark for corner rounding performance on polygon geometries (building extrusions).
 */
export default class RoundPolygonCorners extends Benchmark {
    tileID: CanonicalTileID;
    polygons: Point[][][];
    distanceInMeters: number;

    async setup(): Promise<void> {
        await super.setup();

        this.tileID = new CanonicalTileID(15, 10000, 10000);
        this.distanceInMeters = 15;

        // Generate multiple representative building footprints with outer rings and inner holes
        this.polygons = [];

        for (let b = 0; b < 20; b++) {
            const polygon: Point[][] = [];
            const vertexCount = 40;
            const outerRing: Point[] = [];

            const cx = (EXTENT / 5) * (b % 5 + 0.5);
            const cy = (EXTENT / 4) * (Math.floor(b / 5) + 0.5);
            const radius = EXTENT / 16;

            for (let i = 0; i < vertexCount; i++) {
                const angle = (i / vertexCount) * 2 * Math.PI;
                const r = i % 2 === 0 ? radius : radius * 0.75;
                outerRing.push(new Point(
                    Math.round(cx + Math.cos(angle) * r),
                    Math.round(cy + Math.sin(angle) * r)
                ));
            }
            outerRing.push(new Point(outerRing[0].x, outerRing[0].y));
            polygon.push(outerRing);

            // Add hole ring for half of the buildings
            if (b % 2 === 0) {
                const holeRing: Point[] = [];
                const holeRadius = radius / 3;
                for (let i = 0; i < 16; i++) {
                    const angle = (i / 16) * 2 * Math.PI;
                    holeRing.push(new Point(
                        Math.round(cx + Math.cos(angle) * holeRadius),
                        Math.round(cy + Math.sin(angle) * holeRadius)
                    ));
                }
                holeRing.push(new Point(holeRing[0].x, holeRing[0].y));
                polygon.push(holeRing);
            }

            this.polygons.push(polygon);
        }
    }

    bench(): void {
        for (let i = 0; i < this.polygons.length; i++) {
            roundPolygonCorners(this.polygons[i], this.distanceInMeters, this.tileID);
        }
    }
}
