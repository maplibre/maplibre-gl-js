import {test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../geo/lng_lat.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {MercatorCameraHelper} from '../geo/projection/mercator_camera_helper.ts';
import {coveringTiles} from '../geo/projection/covering_tiles.ts';
import {TilePreloader} from './tile_preloader.ts';

import type {CameraMovement} from './camera_movement.ts';
import type {ITransform} from '../geo/transform_interface.ts';
import type {OverscaledTileID} from '../tile/tile_id.ts';

/** How far the movement travels, in the terms the preload samples it in. */
const DURATION = 3000;
const START_ZOOM = 4;
const END_ZOOM = 11;
const PITCH = 45;
const FRAMES = 60;

/**
 * A pitched movement the length of a hemisphere, which is the shape that gives a preload the most to
 * do: the camera crosses several zoom levels and covers a different set of tiles at each.
 */
function createMovement(): CameraMovement {
    const transform = new MercatorTransform();
    transform.resize(1920, 1080);
    transform.setZoom(START_ZOOM);
    transform.setCenter(new LngLat(-100, 30));
    transform.setPitch(PITCH);

    const handlerOptions = {
        bearing: transform.bearing,
        pitch: PITCH,
        roll: transform.roll,
        padding: transform.padding,
        offsetAsPoint: new Point(0, 0),
        zoom: END_ZOOM,
        center: new LngLat(139.69, 35.68)
    };

    return {
        transform,
        duration: DURATION,
        easing: (k) => k,
        freezeElevation: true,
        elevationCenter: transform.center,
        at: (tr) => {
            const handler = new MercatorCameraHelper().handleEaseTo(tr, handlerOptions);
            return (k) => handler.easeFunc(k);
        },
        applyElevation: () => {}
    };
}

/** A tile that never lands, so the preload keeps everything it asked for and reads no further. */
const loadingTile = {isSettled: () => false} as never;

/** A tile that has landed, so the preload is never waiting on anything and reads the whole path. */
const landedTile = {isSettled: () => true} as never;

/**
 * A source that answers with the tiles it would really cover, so that the measurement includes the
 * pyramid traversal rather than counting it as free.
 */
function createSource(settled: boolean) {
    const tile = settled ? landedTile : loadingTile;
    return {
        used: true,
        coveringTiles: (tr: ITransform) => coveringTiles(tr, {tileSize: 512, minzoom: 0, maxzoom: 14}),
        preloadTiles: (tileIDs: OverscaledTileID[]) => tileIDs.map(() => tile),
        abandonPreloadedTiles: () => {},
        on: () => {},
        off: () => {}
    };
}

function createMap(sourceCount: number, settled = false): never {
    const tileManagers: Record<string, ReturnType<typeof createSource>> = {};
    for (let source = 0; source < sourceCount; source++) {
        tileManagers[`source-${source}`] = createSource(settled);
    }
    return {style: {tileManagers}} as never;
}

/**
 * Everything a preload of the whole path costs: sampling the movement's camera states and working out
 * what every source covers at each of them.
 *
 * The tiles answer as landed, because a preload is only ever held back by the number of requests it
 * has in flight, and this is about the cost of reading the path rather than of the order it reads it
 * in.
 */
function preloadWholePath(frameCount: number, sourceCount: number): void {
    const preloader = new TilePreloader(createMap(sourceCount, true));
    preloader.start(createMovement(), {frameCount});
    preloader.advance(1);
    preloader.cancel();
}

/**
 * What a preload costs across a movement: one start, then a read ahead of the camera at each frame.
 */
function runMovement(preload: boolean): void {
    const preloader = new TilePreloader(preload ? createMap(3) : createMap(0));
    const movement = createMovement();
    if (preload) preloader.start(movement, {frameCount: 8});

    for (let frame = 1; frame <= FRAMES; frame++) {
        preloader.advance(frame / FRAMES);
    }

    if (preload) preloader.finish();
}

test('TilePreloader path sampling', async ({bench}) => {
    await bench.compare(
        bench('movement alone, no preload', () => {
            createMovement();
        }),
        bench('whole path, 4 samples, 1 source', () => {
            preloadWholePath(4, 1);
        }),
        bench('whole path, 8 samples, 1 source', () => {
            preloadWholePath(8, 1);
        }),
        bench('whole path, 16 samples, 1 source', () => {
            preloadWholePath(16, 1);
        }),
        bench('whole path, 8 samples, 3 sources', () => {
            preloadWholePath(8, 3);
        })
    );
});

test('TilePreloader across a movement', async ({bench}) => {
    await bench.compare(
        bench('60 frames, no preload', () => {
            runMovement(false);
        }),
        bench('60 frames, preload over 3 sources', () => {
            runMovement(true);
        })
    );
});
