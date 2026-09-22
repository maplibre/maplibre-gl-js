import {describe, test, expect} from 'vitest';
import {updateFadingTiles} from './tile_manager_raster.ts';
import {FadingDirections, FadingRoles, Tile} from './tile.ts';
import {OverscaledTileID} from './tile_id.ts';
import {InViewTiles} from './tile_manager_in_view_tiles.ts';

const SOURCE_MAX_ZOOM = 14;
const MAX_FADING_ANCESTOR_LEVELS = 3;
const FADE_DURATION = 300;

function addLoadedTile(inViewTiles: InViewTiles, tileID: OverscaledTileID): Tile {
    const tile = new Tile(tileID, 512);
    tile.state = 'loaded';
    inViewTiles.setTile(tileID.key, tile);
    return tile;
}

function updateFading(inViewTiles: InViewTiles, idealID: OverscaledTileID): Record<string, OverscaledTileID> {
    const retain: Record<string, OverscaledTileID> = {};
    updateFadingTiles(inViewTiles, [idealID], retain, MAX_FADING_ANCESTOR_LEVELS, 0, SOURCE_MAX_ZOOM, FADE_DURATION);
    return retain;
}

describe('updateFadingTiles', () => {

    test.each([
        {generation: 'children', depth: 1},
        {generation: 'grandchildren', depth: 2}
    ])('fades $generation at the source max zoom', ({depth}) => {
        const inViewTiles = new InViewTiles();
        const idealZ = SOURCE_MAX_ZOOM - depth;
        const idealID = new OverscaledTileID(idealZ, 0, idealZ, 1000, 800);
        const idealTile = addLoadedTile(inViewTiles, idealID);
        // load a single branch, so the fade can only come from the deepest generation
        let descendentIDs = [idealID];
        for (let level = 0; level < depth; level++) descendentIDs = descendentIDs[0].children(SOURCE_MAX_ZOOM);
        const descendentTiles = descendentIDs.map(descendentID => addLoadedTile(inViewTiles, descendentID));

        const retain = updateFading(inViewTiles, idealID);

        expect(idealTile.fadingRole).toBe(FadingRoles.Parent);
        for (const descendentTile of descendentTiles) {
            expect(descendentTile.fadingDirection).toBe(FadingDirections.Departing);
            expect(descendentTile.fadingParentID).toBe(idealID);
        }
        expect(Object.keys(retain).sort()).toEqual(descendentIDs.map(id => id.key).sort());
    });

    test('does not fade the overscaled child beyond the source max zoom', () => {
        const inViewTiles = new InViewTiles();
        const idealID = new OverscaledTileID(SOURCE_MAX_ZOOM, 0, SOURCE_MAX_ZOOM, 8000, 6000);
        addLoadedTile(inViewTiles, idealID);
        const overscaledChildTile = addLoadedTile(inViewTiles, idealID.children(SOURCE_MAX_ZOOM)[0]);

        const retain = updateFading(inViewTiles, idealID);

        expect(overscaledChildTile.fadingDirection).not.toBe(FadingDirections.Departing);
        expect(retain).toEqual({});
    });
});
