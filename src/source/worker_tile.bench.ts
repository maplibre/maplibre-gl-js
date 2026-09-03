import {bench} from 'vitest';
import {fixtureTiles, parseTile} from '../../test/bench/lib/parse_tile.ts';

await Promise.all(fixtureTiles.map(tile => parseTile(tile, false)));

bench('WorkerTile.parse', async () => {
    for (const tile of fixtureTiles) {
        await parseTile(tile, false);
    }
});
