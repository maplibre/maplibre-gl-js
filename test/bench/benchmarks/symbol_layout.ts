import Layout from './layout';
import {SymbolBucket} from '../../../src/data/bucket/symbol_bucket';
import {performSymbolLayout} from '../../../src/symbol/symbol_layout';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {SubdivisionGranularitySetting} from '../../../src/render/subdivision_granularity_settings';

export default class SymbolLayout extends Layout {
    parsedTiles: Array<any>;

    constructor(style: string, locations?: Array<OverscaledTileID>) {
        super(style, locations);
        this.parsedTiles = [];
    }

    async setup(): Promise<void> {
        await super.setup();
        // Do initial load/parse of tiles and hold onto all the glyph/icon
        // dependencies so that we can re-do symbol layout in isolation
        // during the bench step.
        for (const tile of this.tiles) {
            this.parsedTiles.push(await this.parser.parseTile(tile, true));
        }
    }

    async bench() {
        for (const tileResult of this.parsedTiles) {
            for (const bucket of tileResult.buckets) {
                if (bucket instanceof SymbolBucket) {
                    await performSymbolLayout({
                        bucket,
                        glyphMap: tileResult.glyphMap,
                        glyphPositions: tileResult.glyphPositions,
                        imageMap: tileResult.iconMap,
                        imagePositions: tileResult.imageAtlas.iconPositions,
                        showCollisionBoxes: false,
                        canonical: tileResult.featureIndex.tileID.canonical,
                        subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
                    });
                }
            }
        }
    }
}
