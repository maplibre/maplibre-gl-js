import {test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {MercatorCameraMotions} from './mercator_camera_motions.ts';
import {coveringTiles} from './covering_tiles.ts';
import {createTestCamera, type TestCamera} from '../../util/test/util.ts';
import {getCameraMath} from './camera_math_factory.ts';
import * as cameraUpdates from './camera_updates.ts';
import {getCameraSolver} from './camera_solver_factory.ts';

function createCamera(): TestCamera {
    return createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true, width: 1280, height: 800, center: new LngLat(-73.98, 40.75), zoom: 12.3, pitch: 45, bearing: 30});
}

const {state: view, context, projectedCamera} = createCamera();
const {worldCoordinateHelper} = context;
const points: Point[] = [];
const lngLats: LngLat[] = [];
for (let i = 0; i < 100; i++) {
    points.push(new Point((i * 37) % 1280, (i * 53) % 800));
    lngLats.push(new LngLat(-74.2 + (i % 10) * 0.04, 40.5 + Math.floor(i / 10) * 0.04));
}

test('camera hot paths', async ({bench}) => {
    await bench.compare(
        bench('recenterOnTerrain (per-frame terrain path)', () => {
            for (let i = 0; i < 100; i++) {
                getCameraSolver(context).recenterOnTerrain(cameraUpdates.setElevation(view, context, i % 2 ? 250 : 0), context);
            }
        }),
        bench('calculateCenterFromCameraLngLatAlt (iterative)', () => {
            for (let i = 0; i < 100; i++) {
                cameraUpdates.calculateCenterFromCameraLngLatAlt(view, worldCoordinateHelper, lngLats[i], 4000 + i, 30, 45);
            }
        }),
        bench('getCameraLngLat', () => {
            for (let i = 0; i < 100; i++) {
                getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, worldCoordinateHelper);
            }
        }),
        bench('screenPointToLocation', () => {
            for (let i = 0; i < 100; i++) {
                getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, worldCoordinateHelper, points[i]);
            }
        }),
        bench('locationToScreenPoint', () => {
            for (let i = 0; i < 100; i++) {
                getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, worldCoordinateHelper, lngLats[i]);
            }
        }),
        bench('setLocationAtPoint', () => {
            for (let i = 0; i < 100; i++) {
                getCameraSolver(context).setLocationAtPoint(view, context, lngLats[i], points[i]);
            }
        }),
        bench('coveringTiles', () => {
            coveringTiles(projectedCamera, worldCoordinateHelper, {tileSize: 512, minzoom: 0, maxzoom: 22, reparseOverscaled: false, calculateTileZoom: undefined});
        }),
        bench('easeTo easeFunc (per-frame animation path)', () => {
            const start = createCamera();
            const {easeFunc} = new MercatorCameraMotions().easeTo(start.state, start.context, {
                bearing: 60, pitch: 50, roll: 0, padding: {top: 0, bottom: 0, left: 0, right: 0},
                offsetAsPoint: new Point(0, 0), center: new LngLat(-73.5, 41), zoom: 13.5,
            });
            for (let i = 0; i <= 100; i++) easeFunc(start.state, start.context, i / 100);
        }),
    );
});
