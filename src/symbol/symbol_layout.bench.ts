import {bench} from 'vitest';
import {performSymbolLayout} from './symbol_layout.ts';
import {SymbolBucket} from '../data/bucket/symbol_bucket.ts';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings.ts';
import {fixtureTiles, parseTile} from '../../test/bench/lib/parse_tile.ts';

import type {WorkerTileWithData} from '../source/worker_source.ts';

const parsedTiles = await Promise.all(fixtureTiles.map(async (tile): Promise<WorkerTileWithData> => {
    return await parseTile(tile, true) as WorkerTileWithData;
}));

bench('performSymbolLayout', () => {
    for (const tileResult of parsedTiles) {
        for (const bucket of tileResult.buckets) {
            if (bucket instanceof SymbolBucket) {
                performSymbolLayout({
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
});
