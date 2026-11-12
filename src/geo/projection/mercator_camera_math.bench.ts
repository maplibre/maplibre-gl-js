// @vitest-environment jsdom
// The DEM terrain fixture builds a real painter over the null GL context, which needs a canvas.
import {test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {createDEM, createDEMTerrain, createTestCamera} from '../../util/test/util.ts';
import * as cameraMath from './camera_math.ts';

import type {Terrain} from '../../render/terrain.ts';
import type {ProjectedCamera} from '../projected_camera.ts';
import type {CameraProjection} from './camera_projection.ts';

const DEM_DIM = 256;

function createScene(zoom: number, heightFn: (x: number, y: number) => number, pitch: number): {terrain: Terrain; camera: ProjectedCamera; projection: CameraProjection} {
    const {projectedCamera, context} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true, width: 1024, height: 1024, center: new LngLat(11.4, 47.3), zoom, pitch});

    const tileZoom = Math.max(Math.floor(zoom) - 1, 0);
    const scale = 1 << tileZoom;
    const center = MercatorCoordinate.fromLngLat(projectedCamera.center);
    const centerX = Math.floor(center.x * scale);
    const centerY = Math.floor(center.y * scale);
    const tileIDs: OverscaledTileID[] = [];
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            const x = centerX + dx;
            const y = centerY + dy;
            if (x < 0 || y < 0 || x >= scale || y >= scale) continue;
            tileIDs.push(new OverscaledTileID(tileZoom, 0, tileZoom, x, y));
        }
    }

    const terrain = createDEMTerrain(tileIDs, createDEM(heightFn, DEM_DIM));
    return {terrain, camera: projectedCamera, projection: context.projection};
}

const scenes = [2, 10, 16].flatMap(zoom => [
    {name: `flat hit z${zoom}`, point: new Point(512, 600), ...createScene(zoom, () => 800, 50)},
    {name: `sloped hit z${zoom}`, point: new Point(512, 600), ...createScene(zoom, (x, y) => 400 + 8 * x + 6 * y, 50)},
    {name: `sky miss z${zoom}`, point: new Point(512, 20), ...createScene(zoom, () => 0, 80)},
]);

test('terrain raycast', async ({bench}) => {
    await bench.compare(...scenes.map(({name, point, camera: projectedCamera, projection, terrain}) => bench(name, () => {
        cameraMath.screenTerrainPointToMercatorCoordinate(projectedCamera, projection, point, terrain);
    })));
});
