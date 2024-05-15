import Point from '@mapbox/point-geometry';
import {Projection} from '../../../src/geo/projection/projection';
import {Transform} from '../../../src/geo/transform';
import {CollisionIndex} from '../../../src/symbol/collision_index';
import Benchmark from '../lib/benchmark';
import {mat4} from 'gl-matrix';
import {OverlapMode} from '../../../src/style/style_layer/overlap_mode';
import {CanonicalTileID, UnwrappedTileID} from '../../../src/source/tile_id';
import {SingleCollisionBox} from '../../../src/data/bucket/symbol_bucket';
import {EXTENT} from '../../../src/data/extent';
import {MercatorProjection} from '../../../src/geo/projection/mercator';

type TestSymbol = {
    collisionBox: SingleCollisionBox;
    overlapMode: OverlapMode;
    textPixelRatio: number;
    posMatrix: mat4;
    unwrappedTileID: UnwrappedTileID;
    pitchWithMap: boolean;
    rotateWithMap: boolean;
    translation: [number, number];
    shift?: Point;
}

// For this benchmark we need a deterministic random number generator. This function provides one.
// It returns random floats in range 0..1.
// Taken directly from: https://stackoverflow.com/a/47593316
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

export default class SymbolCollisionBox extends Benchmark {
    private _transform: Transform;
    private _projection: Projection;
    private _symbols: Array<TestSymbol>;

    async setup(): Promise<void> {
        this._transform = new Transform(0, 22, 0, 60, true);
        this._transform.resize(1024, 1024);
        // HM TODO: fix this!
        this._projection = new MercatorProjection();
        const unwrappedTileID = new UnwrappedTileID(0, new CanonicalTileID(0, 0, 0));
        const posMatrix = this._transform.calculatePosMatrix(unwrappedTileID);

        const rng = splitmix32(0xdeadbeef);
        const rndRange = (min, max) => {
            return rng() * (max - min) + min;
        };

        this._symbols = [];

        const symbolCount = 20000;
        for (let i = 0; i < symbolCount; i++) {
            this._symbols.push({
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
                posMatrix,
                unwrappedTileID,
                pitchWithMap: rng() > 0.5,
                rotateWithMap: rng() > 0.5,
                translation: [
                    rndRange(-20, 20),
                    rndRange(-20, 20)
                ],
                shift: rng() > 0.5 ? new Point(rndRange(-20, 20), rndRange(-20, 20)) : undefined
            });
        }
    }

    async bench() {
        const ci = new CollisionIndex(this._transform, this._projection);
        ci.grid.hitTest = (_x1, _y1, _x2, _y2, _overlapMode, _predicate?) => {
            return true;
        };

        for (const s of this._symbols) {
            ci.placeCollisionBox(
                s.collisionBox,
                s.overlapMode,
                s.textPixelRatio,
                s.posMatrix,
                s.unwrappedTileID,
                s.pitchWithMap,
                s.rotateWithMap,
                s.translation,
                null,
                null,
                s.shift
            );
        }
    }
}
