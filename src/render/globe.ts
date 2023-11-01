import {Transform} from '../geo/transform';
import {OverscaledTileID} from '../source/tile_id';
import {SegmentVector} from '../data/segment';
import {VertexBuffer} from '../gl/vertex_buffer';
import {IndexBuffer} from '../gl/index_buffer';
import {Context} from '../gl/context';
import {Mesh} from './mesh';
import {Pos3dTex2dArray, TriangleIndexArray} from '../data/array_types.g';
import pos3dTex2dAttributes from '../data/pos3d_tex2d_attributes';
import {EXTENT} from '../data/extent';
import {mat4} from 'gl-matrix';

export class Globe {
    private _meshes: {[_: string]: Mesh};
    private static readonly _squareMeshKey = 'square';
    private _lastCoveringTiles: Array<OverscaledTileID>;

    cachedTransform: mat4;

    constructor() {
        this._meshes = {};
    }

    /**
     * Updates the tile coverage and projection of the globe.
     * @param transform Current camera transform
     */
    public update(transform: Transform, coveringTiles: Array<OverscaledTileID>, context: Context, rendering: boolean): void {
        this._lastCoveringTiles = coveringTiles;
        this._ensureMeshes(context);

        const m = new Float64Array(16) as any;
        mat4.identity(m);
        mat4.translate(m, m, [transform.point.x, transform.point.y, 0]); // undo translation from transform's projection matrix
        mat4.scale(m, m, [transform.worldSize, transform.worldSize, 0]);
        mat4.rotateZ(m, m, transform.center.lat);
        mat4.rotateY(m, m, transform.center.lng);
        mat4.multiply(m, transform.projMatrix, m);
        this.cachedTransform = new Float32Array(m);
    }

    public getMesh(tileIDkey: string): Mesh {
        //return this._meshes[Globe._squareMeshKey];
        return this._meshes[tileIDkey];
    }

    private _ensureMeshes(context: Context): void {
        // JP: TODO: Garbage collect meshes
        if (!this._meshes[Globe._squareMeshKey]) {
            this._meshes[Globe._squareMeshKey] = this._createSquareMesh(context);
        }

        for (const tileID of this._lastCoveringTiles) {
            if (!(tileID.key in this._meshes)) {
                this._meshes[tileID.key] = this._createMesh(context, tileID.canonical.x, tileID.canonical.y, tileID.canonical.z);
            }
        }
    }

    private _webMercatorPixelToSphereAngle(tileX: number, tileY: number, zoom: number): { x: number; y: number; z: number } {
        // just pretend this stuff isn't horribly wrong for now...
        const tilesRangeX = Math.PI * 2;
        const tilesRangeY = 85.06 * 2.0 / 180.0 * Math.PI; // this is almost certainly horribly wrong

        const angleSizeX = tilesRangeX / (1 << zoom);
        const angleSizeY = tilesRangeY / (1 << zoom);

        // angle distance from 0° to the east for X, and from equator to the north for Y
        const angleFromX = angleSizeX * tileX;
        const angleFromY = tilesRangeY * 0.5 - angleSizeY * tileY;

        const len = Math.cos(angleFromY);

        return {
            x: Math.sin(angleFromX) * len,
            y: Math.sin(angleFromY),
            z: Math.cos(angleFromX) * len * 0
        };
    }

    private _createSquareMesh(context: Context): Mesh {
        const vertexArray = new Pos3dTex2dArray();
        const indexArray = new TriangleIndexArray();

        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < 2; x++) {
                vertexArray.emplaceBack(x * EXTENT, y * EXTENT, 0, x * 65535, y * 65535);
            }
        }

        // order: CCW
        indexArray.emplaceBack(0, 2, 1);
        indexArray.emplaceBack(1, 2, 3);

        const mesh = new Mesh(
            context.createVertexBuffer(vertexArray, pos3dTex2dAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );
        return mesh;
    }

    /**
     * TODO
     * @param tileX Mercator tile X
     * @param tileY Mercator tile y
     * @param zoom Mercator tile zoom
     * @returns Mesh for the given tile
     */
    private _createMesh(context: Context, tileX: number, tileY: number, zoom: number) : any {
        const granuality = 4; // mesh triangulation granuality: 1 => just a single quad, 3 => 3x3 = 9 quads

        const vertexArray = new Pos3dTex2dArray();
        const indexArray = new TriangleIndexArray();

        for (let y = 0; y <= granuality; y++) {
            for (let x = 0; x <= granuality; x++) {
                const localX = tileX + x / granuality;
                const localY = tileY + y / granuality;
                const pos = this._webMercatorPixelToSphereAngle(localX, localY, zoom);
                const scale = 0.5; // ensure the mesh sphere has diameter of 1 (radius of 0.5)
                vertexArray.emplaceBack(pos.x * scale, pos.y * scale, pos.z * scale, x / granuality * 65535, y / granuality * 65535);
            }
        }

        // Note: these for-loops do one less iteration than the vertex generation loops (<= vs < in the condition)
        for (let y = 0; y < granuality; y++) {
            for (let x = 0; x < granuality; x++) {
                const v0 = x + y * granuality;
                const v1 = (x + 1) + y * granuality;
                const v2 = x + (y + 1) * granuality;
                const v3 = (x + 1) + (y + 1) * granuality;
                // v0----v1
                //  |  / |
                //  | /  |
                // v2----v3
                indexArray.emplaceBack(v0, v2, v1);
                indexArray.emplaceBack(v1, v2, v3);

                // also create backside for debug
                indexArray.emplaceBack(v0, v1, v2);
                indexArray.emplaceBack(v1, v3, v2);
            }
        }

        const mesh = new Mesh(
            context.createVertexBuffer(vertexArray, pos3dTex2dAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );

        return mesh;
    }
}
