import {describe, test, expect} from 'vitest';
import {InViewTiles} from './tile_manager_in_view_tiles';
import {Tile} from './tile';
import {OverscaledTileID} from './tile_id';

describe('InViewTiles', () => {
    test('getRenderableIds returns only renderable tiles', () => {
        const inViewTiles = new InViewTiles();
        const tile1 = new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512);
        tile1.state = 'loaded'; // renderable
        const tile2 = new Tile(new OverscaledTileID(1, 0, 0, 0, 0), 512);
        tile2.state = 'loading'; // not renderable

        inViewTiles.setTile(tile1.tileID.key, tile1);
        inViewTiles.setTile(tile2.tileID.key, tile2);

        const renderableIds = inViewTiles.getRenderableIds();
        expect(renderableIds).toEqual([tile1.tileID.key]);
    });

    test('getRenderableIds sorts by tile ID when symbolLayer is false', () => {
        const inViewTiles = new InViewTiles();
        const tile1 = new Tile(new OverscaledTileID(1, 0, 1, 1, 0), 512);
        tile1.state = 'loaded';
        const tile2 = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512);
        tile2.state = 'loaded';

        inViewTiles.setTile(tile1.tileID.key, tile1);
        inViewTiles.setTile(tile2.tileID.key, tile2);

        const renderableIds = inViewTiles.getRenderableIds();
        // compareTileId sorts by z (asc), then y (desc), then x (desc).
        // tile1: z=1, x=1, y=0.
        // tile2: z=1, x=0, y=0.
        // tile1.x > tile2.x, so tile1 comes first.
        expect(renderableIds).toEqual([tile1.tileID.key, tile2.tileID.key]);
    });

    test('getRenderableIds sorts by bearing (0 degrees) and coordinates when symbolLayer is true', () => {
        const inViewTiles = new InViewTiles();
        
        // Same Z, different Y
        const tile1 = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512); // 0,0
        tile1.state = 'loaded';
        const tile2 = new Tile(new OverscaledTileID(1, 0, 1, 0, 1), 512); // 0,1 (below tile1)
        tile2.state = 'loaded';

        inViewTiles.setTile(tile1.tileID.key, tile1);
        inViewTiles.setTile(tile2.tileID.key, tile2);

        // Case 1: Bearing 0.
        // rotatedB.y (1) - rotatedA.y (0) = 1 > 0. b comes first.
        const renderableIds = inViewTiles.getRenderableIds(0, true);
        expect(renderableIds).toEqual([tile2.tileID.key, tile1.tileID.key]);
    });

    test('getRenderableIds sorts by bearing (180 degrees) and coordinates when symbolLayer is true', () => {
        const inViewTiles = new InViewTiles();
        
        // Same Z, different Y
        const tile1 = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512); // 0,0
        tile1.state = 'loaded';
        const tile2 = new Tile(new OverscaledTileID(1, 0, 1, 0, 1), 512); // 0,1 (below tile1)
        tile2.state = 'loaded';

        inViewTiles.setTile(tile1.tileID.key, tile1);
        inViewTiles.setTile(tile2.tileID.key, tile2);

        // Case 2: Bearing 180 degrees (PI).
        // rotatedB.y (-1) - rotatedA.y (0) = -1 < 0. a comes first.
        const renderableIds = inViewTiles.getRenderableIds(Math.PI, true);
        expect(renderableIds).toEqual([tile1.tileID.key, tile2.tileID.key]);
    });

    test('handleWrapJump updates tile IDs with correct wrap', () => {
        const inViewTiles = new InViewTiles();
        const tile = new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512);
        inViewTiles.setTile(tile.tileID.key, tile);

        inViewTiles.handleWrapJump(1);

        const tiles = inViewTiles.getAllTiles();
        expect(tiles.length).toBe(1);
        expect(tiles[0].tileID.wrap).toBe(1);
        expect(inViewTiles.getTileById(tiles[0].tileID.key)).toBe(tiles[0]);
    });

    test('handleWrapJump updates multiple tiles correctly', () => {
        const inViewTiles = new InViewTiles();
        const tile1 = new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512);
        const tile2 = new Tile(new OverscaledTileID(0, 1, 0, 0, 0), 512);
        inViewTiles.setTile(tile1.tileID.key, tile1);
        inViewTiles.setTile(tile2.tileID.key, tile2);

        inViewTiles.handleWrapJump(-1);

        const tiles = inViewTiles.getAllTiles();
        expect(tiles.length).toBe(2);
        
        const updatedTile1 = tiles.find(t => t.uid === tile1.uid);
        const updatedTile2 = tiles.find(t => t.uid === tile2.uid);

        expect(updatedTile1?.tileID.wrap).toBe(-1);
        expect(updatedTile2?.tileID.wrap).toBe(0);
        
        expect(inViewTiles.getTileById(updatedTile1!.tileID.key)).toBe(updatedTile1);
        expect(inViewTiles.getTileById(updatedTile2!.tileID.key)).toBe(updatedTile2);
    });
});
