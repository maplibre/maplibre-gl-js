import {test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {CollisionIndex} from './collision_index.ts';
import {EXTENT} from '../data/extent.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {calculatePosMatrix} from '../geo/projection/mercator_camera_math.ts';
import {createTestCamera} from '../util/test/util.ts';

import type {mat4} from 'gl-matrix';
import type {MercatorProjectedCamera, ProjectedCamera} from '../geo/projected_camera.ts';
import type {UnwrappedTileID} from '../tile/tile_id.ts';
import type {SingleCollisionBox} from '../data/bucket/symbol_bucket.ts';
import type {OverlapMode} from '../style/style_layer/overlap_mode.ts';

type TestSymbol = {
    collisionBox: SingleCollisionBox;
    overlapMode: OverlapMode;
    textPixelRatio: number;
    tileID: OverscaledTileID;
    unwrappedTileID: UnwrappedTileID;
    pitchWithMap: boolean;
    rotateWithMap: boolean;
    translation: [number, number];
    shift?: Point;
    simpleProjectionMatrix?: mat4;
};

// https://stackoverflow.com/a/47593316
function splitmix32(a: number): () => number {
    return function() {
        a |= 0;
        a = a + 0x9e3779b9 | 0;
        let t = a ^ a >>> 16;
        t = Math.imul(t, 0x21f0aaad);
        t = t ^ t >>> 15;
        t = Math.imul(t, 0x735a2d97);
        return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
    };
}

const symbolCount = 20000;

function createSymbols(calculatePosMatrix: (tileID: UnwrappedTileID) => mat4 | undefined): TestSymbol[] {
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const unwrappedTileID = tileID.toUnwrapped();
    const rng = splitmix32(0xdeadbeef);
    const rndRange = (min: number, max: number) => rng() * (max - min) + min;
    const symbols: TestSymbol[] = [];

    for (let i = 0; i < symbolCount; i++) {
        symbols.push({
            collisionBox: {
                anchorPointX: rndRange(4, EXTENT - 4),
                anchorPointY: rndRange(4, EXTENT - 4),
                x1: rndRange(-20, -2),
                y1: rndRange(-20, -2),
                x2: rndRange(2, 20),
                y2: rndRange(2, 20)
            },
            overlapMode: 'never',
            textPixelRatio: 1,
            tileID,
            unwrappedTileID,
            pitchWithMap: rng() > 0.5,
            rotateWithMap: rng() > 0.5,
            translation: [
                rndRange(-20, 20),
                rndRange(-20, 20)
            ],
            shift: rng() > 0.5 ? new Point(rndRange(-20, 20), rndRange(-20, 20)) : undefined,
            simpleProjectionMatrix: calculatePosMatrix(unwrappedTileID),
        });
    }

    return symbols;
}

function placeAll(projectedCamera: ProjectedCamera, symbols: TestSymbol[]): void {
    const collisionIndex = new CollisionIndex(projectedCamera);
    collisionIndex.grid.hitTest = () => true;

    for (const symbol of symbols) {
        collisionIndex.placeCollisionBox(
            symbol.collisionBox,
            symbol.overlapMode,
            symbol.textPixelRatio,
            symbol.tileID,
            symbol.unwrappedTileID,
            symbol.pitchWithMap,
            symbol.rotateWithMap,
            symbol.translation,
            null,
            null,
            symbol.shift,
            symbol.simpleProjectionMatrix,
        );
    }
}

const mercatorCamera = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true, width: 1024, height: 1024}).projectedCamera as MercatorProjectedCamera;
const mercatorSymbols = createSymbols((tileID) => calculatePosMatrix(mercatorCamera, tileID, false));

const globeCamera = createTestCamera({width: 1024, height: 1024}, {projection: 'globe'}).projectedCamera;
const globeSymbols = createSymbols(() => undefined);

test('placeCollisionBox', async ({bench}) => {
    await bench.compare(
        bench('mercator', () => {
            placeAll(mercatorCamera, mercatorSymbols);
        }),
        bench('globe', () => {
            placeAll(globeCamera, globeSymbols);
        }),
    );
});
