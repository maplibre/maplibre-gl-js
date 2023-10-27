import {Transform} from '../geo/transform';
import {OverscaledTileID} from '../source/tile_id';

export class Globe {

    /**
     * Updates the tile coverage and projection of the globe.
     * @param transform Current camera transform
     */
    public update(transform: Transform): void {
        // JP: TODO: not implemented
    }

    /**
     * Gets a list of tiles
     * @returns the renderable tiles
     */
    public getRenderableTileIDs(): Array<OverscaledTileID> {
        return [];
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
