import {test} from 'vitest';
import {LngLat} from '../lng_lat.ts';
import {coveringTiles} from './covering_tiles.ts';
import {createMercatorTransform} from './mercator_transform.ts';
import {createGlobeTransform} from './globe_transform.ts';

import type {ITransform} from '../transform_interface.ts';

function coverWithPitch(transform: ITransform, pitch: number): void {
    transform.setCenter(new LngLat(0, 0));
    transform.setZoom(4);
    transform.resize(4096, 4096, true);
    transform.setMaxPitch(pitch);
    transform.setPitch(pitch);

    for (let i = 0; i < 40; i++) {
        transform.setCenter(new LngLat(i * 0.2, 0));
        coveringTiles(transform, {
            tileSize: 256,
        });
    }
}

test('coveringTiles', async ({bench}) => {
    await bench.compare(
        bench('mercator', () => {
            coverWithPitch(createMercatorTransform(), 0);
        }),
        bench('mercator pitched', () => {
            coverWithPitch(createMercatorTransform(), 60);
        }),
        bench('globe', () => {
            coverWithPitch(createGlobeTransform(), 0);
        }),
        bench('globe pitched', () => {
            coverWithPitch(createGlobeTransform(), 60);
        }),
    );
});
