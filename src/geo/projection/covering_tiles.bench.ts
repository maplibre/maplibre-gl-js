import {test} from 'vitest';
import {LngLat} from '../lng_lat.ts';
import {coveringTiles} from './covering_tiles.ts';
import {createCameraState} from '../camera_state.ts';
import {createGlobeCameraProjection, createMercatorCameraProjection, type CameraProjection} from './camera_projection.ts';
import {projectCamera} from './camera_math.ts';
import * as cameraUpdates from './camera_updates.ts';

import type {CameraContext} from './camera_constrain.ts';

function coverWithPitch(projection: CameraProjection, pitch: number): void {
    const context: CameraContext = {projection, constrainOverride: null};
    let state = createCameraState();
    state = cameraUpdates.setCenter(state, context, new LngLat(0, 0));
    state = cameraUpdates.setZoom(state, context, 4);
    state = cameraUpdates.resize(state, context, 4096, 4096, true);
    state = cameraUpdates.setMaxPitch(state, pitch);
    state = cameraUpdates.setPitch(state, pitch);

    for (let i = 0; i < 40; i++) {
        state = cameraUpdates.setCenter(state, context, new LngLat(i * 0.2, 0));
        coveringTiles(projectCamera(state, projection), projection, {
            tileSize: 256,
        });
    }
}

test('coveringTiles', async ({bench}) => {
    await bench.compare(
        bench('mercator', () => {
            coverWithPitch(createMercatorCameraProjection(), 0);
        }),
        bench('mercator pitched', () => {
            coverWithPitch(createMercatorCameraProjection(), 60);
        }),
        bench('globe', () => {
            coverWithPitch(createGlobeCameraProjection(), 0);
        }),
        bench('globe pitched', () => {
            coverWithPitch(createGlobeCameraProjection(), 60);
        }),
    );
});
