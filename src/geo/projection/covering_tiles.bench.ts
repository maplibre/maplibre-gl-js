import {test} from 'vitest';
import {LngLat} from '../lng_lat.ts';
import {coveringTiles} from './covering_tiles.ts';
import {createCameraViewState} from '../camera_view_state.ts';
import {createCameraContext, type CameraProjectionKind} from './camera_context.ts';
import {projectCamera} from './camera_math.ts';
import * as cameraUpdates from './camera_updates.ts';

function coverWithPitch(projection: CameraProjectionKind, pitch: number): void {
    const context = createCameraContext({projection});
    let view = createCameraViewState();
    view = cameraUpdates.setCenter(view, context, new LngLat(0, 0));
    view = cameraUpdates.setZoom(view, context, 4);
    view = cameraUpdates.resize(view, context, 4096, 4096, true);
    view = cameraUpdates.setMaxPitch(view, pitch);
    view = cameraUpdates.setPitch(view, pitch);

    for (let i = 0; i < 40; i++) {
        view = cameraUpdates.setCenter(view, context, new LngLat(i * 0.2, 0));
        coveringTiles(projectCamera(view, context), context.worldCoordinateHelper, {
            tileSize: 256,
        });
    }
}

test('coveringTiles', async ({bench}) => {
    await bench.compare(
        bench('mercator', () => {
            coverWithPitch('mercator', 0);
        }),
        bench('mercator pitched', () => {
            coverWithPitch('mercator', 60);
        }),
        bench('globe', () => {
            coverWithPitch('globe', 0);
        }),
        bench('globe pitched', () => {
            coverWithPitch('globe', 60);
        }),
    );
});
