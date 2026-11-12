import {test} from 'vitest';
import {LngLat} from '../lng_lat.ts';
import {coveringTiles} from './covering_tiles.ts';
import {createCameraViewState} from '../camera_view_state.ts';
import {createGlobeCameraProjection, createMercatorCameraProjection, type CameraProjection} from './camera_projection.ts';
import {projectCamera} from './camera_math.ts';
import * as cameraUpdates from './camera_updates.ts';

import type {CameraContext} from './camera_constrain.ts';

function coverWithPitch(projection: CameraProjection, pitch: number): void {
    const context: CameraContext = {projection, constrainOverride: null};
    let view = createCameraViewState();
    view = cameraUpdates.setCenter(view, context, new LngLat(0, 0));
    view = cameraUpdates.setZoom(view, context, 4);
    view = cameraUpdates.resize(view, context, 4096, 4096, true);
    view = cameraUpdates.setMaxPitch(view, pitch);
    view = cameraUpdates.setPitch(view, pitch);

    for (let i = 0; i < 40; i++) {
        view = cameraUpdates.setCenter(view, context, new LngLat(i * 0.2, 0));
        coveringTiles(projectCamera(view, projection), projection, {
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
