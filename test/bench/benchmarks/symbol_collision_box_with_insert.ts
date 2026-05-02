import {type ITransform} from '../../../src/geo/transform_interface.ts';
import {CollisionIndex} from '../../../src/symbol/collision_index.ts';
import Benchmark from '../lib/benchmark.ts';
import {type OverlapMode} from '../../../src/style/style_layer/overlap_mode.ts';
import {OverscaledTileID, type UnwrappedTileID} from '../../../src/tile/tile_id.ts';
import {type SingleCollisionBox} from '../../../src/data/bucket/symbol_bucket.ts';
import {EXTENT} from '../../../src/data/extent.ts';
import {MercatorTransform} from '../../../src/geo/projection/mercator_transform.ts';
import {type mat4} from 'gl-matrix';

type TestSymbol = {
    collisionBox: SingleCollisionBox;
    overlapMode: OverlapMode;
    textPixelRatio: number;
    tileID: OverscaledTileID;
    unwrappedTileID: UnwrappedTileID;
    pitchWithMap: boolean;
    rotateWithMap: boolean;
    translation: [number, number];
    simpleProjectionMatrix?: mat4;
};

// Deterministic PRNG for reproducible benchmarks
function splitmix32(a) {
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

/**
 * Benchmarks collision detection with real insert + hitTest cycles.
 * Unlike SymbolCollisionBox, hitTest is NOT mocked: placed symbols are
 * inserted into the index so subsequent queries hit a populated spatial index.
 * Supports uniform and clustered distributions to stress-test different patterns.
 */
export default class SymbolCollisionBoxWithInsert extends Benchmark {
    private _transform: ITransform;
    private _symbols: TestSymbol[];
    private _symbolCount: number;
    private _clustered: boolean;

    constructor(symbolCount: number = 100000, clustered: boolean = false) {
        super();
        this._symbolCount = symbolCount;
        this._clustered = clustered;
    }

    async setup(): Promise<void> {
        const tr = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        this._transform = tr;
        tr.resize(1024, 1024);
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const unwrappedTileID = tileID.toUnwrapped();
        const posMatrix = tr.calculatePosMatrix(unwrappedTileID, false);

        const rng = splitmix32(0xdeadbeef);
        const rndRange = (min, max) => rng() * (max - min) + min;

        this._symbols = [];

        for (let i = 0; i < this._symbolCount; i++) {
            let anchorX: number, anchorY: number;

            if (this._clustered) {
                // Clustered: 80% of symbols packed into 10% of the tile area
                if (rng() < 0.8) {
                    anchorX = rndRange(EXTENT * 0.4, EXTENT * 0.5);
                    anchorY = rndRange(EXTENT * 0.4, EXTENT * 0.5);
                } else {
                    anchorX = rndRange(4, EXTENT - 4);
                    anchorY = rndRange(4, EXTENT - 4);
                }
            } else {
                // Uniform distribution across the tile
                anchorX = rndRange(4, EXTENT - 4);
                anchorY = rndRange(4, EXTENT - 4);
            }

            this._symbols.push({
                collisionBox: {
                    anchorPointX: anchorX,
                    anchorPointY: anchorY,
                    x1: rndRange(-20, -2),
                    y1: rndRange(-20, -2),
                    x2: rndRange(2, 20),
                    y2: rndRange(2, 20)
                },
                overlapMode: 'never',
                textPixelRatio: 1,
                tileID,
                unwrappedTileID,
                pitchWithMap: false,
                rotateWithMap: false,
                translation: [0, 0],
                simpleProjectionMatrix: posMatrix,
            });
        }
    }

    bench() {
        const ci = new CollisionIndex(this._transform);

        // Place and insert: real collision detection with a growing index
        for (let i = 0; i < this._symbols.length; i++) {
            const s = this._symbols[i];
            const placed = ci.placeCollisionBox(
                s.collisionBox,
                s.overlapMode,
                s.textPixelRatio,
                s.tileID,
                s.unwrappedTileID,
                s.pitchWithMap,
                s.rotateWithMap,
                s.translation,
                null,
                null,
                undefined,
                s.simpleProjectionMatrix,
            );
            // Insert placed symbols so the index grows and queries get harder
            if (placed.placeable) {
                ci.insertCollisionBox(
                    placed.box,
                    s.overlapMode,
                    false,
                    0,
                    i,
                    0
                );
            }
        }
    }
}
