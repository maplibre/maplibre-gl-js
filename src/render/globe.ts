import {Transform} from '../geo/transform';
import {OverscaledTileID} from '../source/tile_id';
import {SegmentVector} from '../data/segment';
import {Context} from '../gl/context';
import {Mesh} from './mesh';
import {Pos3dTex2dArray, TriangleIndexArray} from '../data/array_types.g';
import pos3dTex2dAttributes from '../data/pos3d_tex2d_attributes';
import {EXTENT} from '../data/extent';
import {mat4} from 'gl-matrix';
import {webMercatorToSpherePoint} from '../geo/mercator_coordinate';

export class Globe {
    private _meshes: {[_: string]: Mesh};
    private static readonly _squareMeshKey = 'square';
    private _lastCoveringTiles: Array<OverscaledTileID>;

    public useRtt: boolean = false;

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

        const degreesToRadians = Math.PI / 180.0;
        const m = new Float64Array(16) as any;
        mat4.identity(m);
        // undo translation from transform's projection matrix
        mat4.translate(m, m, [transform.point.x, transform.point.y, 0]);
        // scale the globe to the size of mercator zoom 0 tile,
        // also undo the _pixelPerMeter scaling from transform.ts projection matrix
        mat4.scale(m, m, [transform.worldSize, transform.worldSize, transform.worldSize / transform._pixelPerMeter]);
        // offset the sphere down to its top touches the regular map plane (visible when pitch > 0)
        mat4.translate(m, m, [0.0, 0, -0.5]);
        // Rotate the sphere to center it on viewed coordinates
        mat4.rotateX(m, m, -transform.center.lat * degreesToRadians);
        mat4.rotateY(m, m, -transform.center.lng * degreesToRadians);
        // Flip it upside down
        mat4.scale(m, m, [1, -1, 1]);
        mat4.scale(m, m, [0.5, 0.5, 0.5]); // Scale the unit sphere to a sphere with diameter of 1
        // Finally, apply transform's projection matrix
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

        for (const tileID of (this._lastCoveringTiles || [])) {
            if (!(tileID.key in this._meshes)) {
                this._meshes[tileID.key] = this._createMesh(context, tileID.canonical.x, tileID.canonical.y, tileID.canonical.z);
            }
        }
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
        let granuality = 24; // mesh triangulation granuality: 1 => just a single quad, 3 => 3x3 = 9 quads

        // Boost mesh granuality for when sphere edges are likely to be visible - avoid jagged edges
        if (zoom === 0) {
            granuality *= 4;
        } else if (zoom === 1) {
            granuality *= 2;
        }

        const verticesPerAxis = granuality + 1;

        // JP: TODO: for meshes neighbouring the poles, generate triangles all the way to the poles

        const vertexArray = new Pos3dTex2dArray();
        const indexArray = new TriangleIndexArray();

        for (let y = 0; y < verticesPerAxis; y++) {
            for (let x = 0; x < verticesPerAxis; x++) {
                const localX = tileX + x / granuality;
                const localY = tileY + y / granuality;
                const pos = webMercatorToSpherePoint(localX, localY, zoom);
                vertexArray.emplaceBack(pos[0], pos[1], pos[2], x / granuality * 65535, y / granuality * 65535);
            }
        }

        for (let y = 0; y < granuality; y++) {
            for (let x = 0; x < granuality; x++) {
                const v0 = x + y * verticesPerAxis;
                const v1 = (x + 1) + y * verticesPerAxis;
                const v2 = x + (y + 1) * verticesPerAxis;
                const v3 = (x + 1) + (y + 1) * verticesPerAxis;
                // v0----v1
                //  |  / |
                //  | /  |
                // v2----v3
                indexArray.emplaceBack(v0, v2, v1);
                indexArray.emplaceBack(v1, v2, v3);
            }
        }

        // North pole
        if (tileY === 0) {
            vertexArray.emplaceBack(0, 0.5, 0, 32768, 0);
            for (let x = 0; x < granuality; x++) {
                const v0 = vertexArray.length - 1;
                const v1 = x;
                const v2 = x + 1;
                indexArray.emplaceBack(v0, v1, v2);
            }
        }

        // South pole
        if (tileY === (1 << zoom) - 1) {
            vertexArray.emplaceBack(0, -0.5, 0, 32768, 65535);
            for (let x = 0; x < granuality; x++) {
                const v0 = vertexArray.length - 1;
                const v1 = x + verticesPerAxis * (verticesPerAxis - 1);
                const v2 = x + 1 + verticesPerAxis * (verticesPerAxis - 1);
                indexArray.emplaceBack(v0, v2, v1);
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
