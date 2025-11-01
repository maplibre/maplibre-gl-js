import {type TileManager, type TileManagerStrategy} from './tile_manager';
import {MercatorCoordinate} from '../geo/mercator_coordinate';
import {EXTENT} from '../data/extent';
import {Bounds} from '../geo/bounds';
import {EXTENT_BOUNDS} from '../data/extent_bounds';
import type {Tile} from './tile';
import type {OverscaledTileID} from './tile_id';
import type {Source} from '../source/source';
import type Point from '@mapbox/point-geometry';

export type TileResult = {
    tile: Tile;
    tileID: OverscaledTileID;
    queryGeometry: Array<Point>;
    cameraQueryGeometry: Array<Point>;
    scale: number;
};

/**
 * Vector-specific tile management strategy
 *
 * Responsibilities specific to vector tiles:
 *  - Managing symbol fade hold duration to prevent label flicker
 *  - Retaining tiles with symbols for gradual fade out
 *  - Coordinating symbol placement across tile boundaries
 */
export class VectorTileStrategy implements TileManagerStrategy {
    private tileManager: TileManager;

    constructor(tileManager: TileManager) {
        this.tileManager = tileManager;
    }

    cleanUpTiles(tiles: Record<string, Tile>, retain: Record<string, OverscaledTileID>, removeTile: (id: string) => void): void {
        for (const key in tiles) {
            const tile = tiles[key];

            // retained - clear fade hold so if it's removed again fade timer starts fresh.
            if (retain[key]) {
                tile.clearSymbolFadeHold();
                continue;
            }

            // remove non-retained tiles without symbols
            if (!tile.hasSymbolBuckets) {
                removeTile(key);
                continue;
            }

            // for tile with symbols - hold for fade - then remove
            if (!tile.holdingForSymbolFade()) {
                tile.setSymbolHoldDuration(this.tileManager.getMapFadeDuration());
            } else if (tile.symbolFadeFinished()) {
                removeTile(key);
            }
        }
    }

    isTileRenderable(tile: Tile, symbolLayer?: boolean): boolean {
        return (
            tile?.hasData() &&
            (symbolLayer || !tile.holdingForSymbolFade())
        );
    }

    hasTransition(source: Source): boolean {
        return source.hasTransition();
    }

    /**
     * Release all tiles that are held for symbol fading.
     * This is useful when forcing an immediate cleanup without waiting for fade completion.
     */
    releaseSymbolFadeTiles() {
        const tiles = this.tileManager.getTiles();
        for (const id in tiles) {
            if (tiles[id].holdingForSymbolFade()) {
                this.tileManager.removeTile(id);
            }
        }
    }

    /**
     * Search through our current tiles and attempt to find the tiles that
     * cover the given bounds.
     * @param pointQueryGeometry - coordinates of the corners of bounding rectangle
     * @returns result items have `{tile, minX, maxX, minY, maxY}`, where min/max bounding values are the given bounds transformed in into the coordinate space of this tile.
     */
    tilesIn(pointQueryGeometry: Array<Point>, maxPitchScaleFactor: number, has3DLayer: boolean): TileResult[] {
        const tileResults: TileResult[] = [];

        const transform = this.tileManager.getTransform();
        if (!transform) return tileResults;
        const allowWorldCopies = transform.getCoveringTilesDetailsProvider().allowWorldCopies();

        const cameraPointQueryGeometry = has3DLayer ?
            transform.getCameraQueryGeometry(pointQueryGeometry) :
            pointQueryGeometry;

        const project = (point: Point) => transform.screenPointToMercatorCoordinate(point, this.tileManager.terrain);
        const queryGeometry = this._transformBbox(pointQueryGeometry, project, !allowWorldCopies);
        const cameraQueryGeometry = this._transformBbox(cameraPointQueryGeometry, project, !allowWorldCopies);
        const cameraBounds = Bounds.fromPoints(cameraQueryGeometry);

        const ids = this.tileManager.getIds();
        const tiles = this.tileManager.getTiles();

        for (let i = 0; i < ids.length; i++) {
            const tile = tiles[ids[i]];
            if (tile.holdingForSymbolFade()) {
                // Tiles held for fading are covered by tiles that are closer to ideal
                continue;
            }
            // if the projection does not render world copies then we need to explicitly check for the bounding box crossing the antimeridian
            const tileIDs = allowWorldCopies ? [tile.tileID] : [tile.tileID.unwrapTo(-1), tile.tileID.unwrapTo(0)];
            const scale = Math.pow(2, transform.zoom - tile.tileID.overscaledZ);
            const queryPadding = maxPitchScaleFactor * tile.queryPadding * EXTENT / tile.tileSize / scale;

            for (const tileID of tileIDs) {

                const tileSpaceBounds = cameraBounds.map(point => tileID.getTilePoint(new MercatorCoordinate(point.x, point.y)));
                tileSpaceBounds.expandBy(queryPadding);

                if (tileSpaceBounds.intersects(EXTENT_BOUNDS)) {

                    const tileSpaceQueryGeometry: Array<Point> = queryGeometry.map((c) => tileID.getTilePoint(c));
                    const tileSpaceCameraQueryGeometry = cameraQueryGeometry.map((c) => tileID.getTilePoint(c));

                    tileResults.push({
                        tile,
                        tileID: allowWorldCopies ? tileID : tileID.unwrapTo(0),
                        queryGeometry: tileSpaceQueryGeometry,
                        cameraQueryGeometry: tileSpaceCameraQueryGeometry,
                        scale
                    });
                }
            }
        }

        return tileResults;
    }

    _transformBbox(geom: Point[], project: (point: Point) => MercatorCoordinate, checkWrap: boolean): MercatorCoordinate[] {
        let transformed = geom.map(project);
        if (checkWrap) {
            // If the projection does not allow world copies, then a bounding box may span the antimeridian and
            // instead of a bounding box going from 179°E to 179°W, it goes from 179°W to 179°E and covers the entire
            // planet except for what should be inside it.
            const bounds = Bounds.fromPoints(geom);
            bounds.shrinkBy(Math.min(bounds.width(), bounds.height()) * 0.001);
            const projected = bounds.map(project);

            const newBounds = Bounds.fromPoints(transformed);

            if (!newBounds.covers(projected)) {
                transformed = transformed.map((coord) => coord.x > 0.5 ?
                    new MercatorCoordinate(coord.x - 1, coord.y, coord.z) :
                    coord
                );
            }
        }
        return transformed;
    }
}
