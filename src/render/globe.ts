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

export class Globe {
    private _meshes: {[_: string]: Mesh};
    private static readonly _squareMeshKey = 'square';

    constructor() {
        this._meshes = {};
    }

    /**
     * Updates the tile coverage and projection of the globe.
     * @param transform Current camera transform
     */
    public update(transform: Transform, coveringTiles: Array<OverscaledTileID>, context: Context, rendering: boolean): void {
        // JP: TODO: not implemented
        this._ensureMeshes(context);
    }

    public getMesh(tileIDkey: string): Mesh {
        return this._meshes[Globe._squareMeshKey];
        //return this._meshes[tileIDkey];
    }

    private _ensureMeshes(context: Context): void {
        if (!this._meshes[Globe._squareMeshKey]) {
            const vertexArray = new Pos3dTex2dArray();
            const indexArray = new TriangleIndexArray();

            for (let y = 0; y <= 2; y++) {
                for (let x = 0; x <= 2; x++) {
                    vertexArray.emplaceBack(x * EXTENT, y * EXTENT, 0, x, y);
                }
            }

            indexArray.emplaceBack(0, 1, 2);
            indexArray.emplaceBack(0, 2, 1);

            const mesh = new Mesh(
                context.createVertexBuffer(vertexArray, pos3dTex2dAttributes.members),
                context.createIndexBuffer(indexArray),
                SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
            );
            this._meshes[Globe._squareMeshKey] = mesh;
        }
    }

    /**
     * TODO
     * @param x Mercator tile X
     * @param y Mercator tile y
     * @param z Mercator tile zoom
     * @returns Mesh for the given tile
     */
    private _createMesh(x: number, y: number, z: number) : any {
        // JP: TODO: proper stitching with neighbouring meshes
        return undefined; // not implemented
    }
}
