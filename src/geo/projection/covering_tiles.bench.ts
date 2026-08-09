import {bench, describe} from 'vitest';
import {LngLat} from '../lng_lat.ts';
import {coveringTiles} from './covering_tiles.ts';
import {MercatorTransform} from './mercator_transform.ts';
import {GlobeTransform} from './globe_transform.ts';
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

describe('coveringTiles', () => {
    bench('mercator', () => {
        coverWithPitch(new MercatorTransform(), 0);
    });

    bench('mercator pitched', () => {
        coverWithPitch(new MercatorTransform(), 60);
    });

    bench('globe', () => {
        coverWithPitch(new GlobeTransform(), 0);
    });

    bench('globe pitched', () => {
        coverWithPitch(new GlobeTransform(), 60);
    });
});
