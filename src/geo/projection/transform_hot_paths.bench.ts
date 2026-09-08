import {bench} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {MercatorTransform} from './mercator_transform.ts';
import {MercatorCameraHelper} from './mercator_camera_helper.ts';
import {coveringTiles} from './covering_tiles.ts';

function createTransform(): MercatorTransform {
    const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
    transform.resize(1280, 800);
    transform.setCenter(new LngLat(-73.98, 40.75));
    transform.setZoom(12.3);
    transform.setPitch(45);
    transform.setBearing(30);
    return transform;
}

const transform = createTransform();
const points: Point[] = [];
const lngLats: LngLat[] = [];
for (let i = 0; i < 100; i++) {
    points.push(new Point((i * 37) % 1280, (i * 53) % 800));
    lngLats.push(new LngLat(-74.2 + (i % 10) * 0.04, 40.5 + Math.floor(i / 10) * 0.04));
}

bench('recalculateZoomAndCenter (per-frame terrain path)', () => {
    for (let i = 0; i < 100; i++) {
        transform.setElevation(i % 2 ? 250 : 0);
        transform.recalculateZoomAndCenter();
    }
});

bench('calculateCenterFromCameraLngLatAlt (iterative)', () => {
    for (let i = 0; i < 100; i++) {
        transform.calculateCenterFromCameraLngLatAlt(lngLats[i], 4000 + i, 30, 45);
    }
});

bench('getCameraLngLat', () => {
    for (let i = 0; i < 100; i++) {
        transform.getCameraLngLat();
    }
});

bench('screenPointToLocation', () => {
    for (let i = 0; i < 100; i++) {
        transform.screenPointToLocation(points[i]);
    }
});

bench('locationToScreenPoint', () => {
    for (let i = 0; i < 100; i++) {
        transform.locationToScreenPoint(lngLats[i]);
    }
});

bench('setLocationAtPoint', () => {
    for (let i = 0; i < 100; i++) {
        transform.setLocationAtPoint(lngLats[i], points[i]);
    }
});

bench('lngLatToCameraDepth', () => {
    for (let i = 0; i < 100; i++) {
        transform.lngLatToCameraDepth(lngLats[i], 0);
    }
});

bench('coveringTiles', () => {
    coveringTiles(transform, {tileSize: 512, minzoom: 0, maxzoom: 22, reparseOverscaled: false, calculateTileZoom: undefined});
});

const cameraHelper = new MercatorCameraHelper();
bench('easeTo easeFunc (per-frame animation path)', () => {
    const tr = createTransform();
    const {easeFunc} = cameraHelper.handleEaseTo(tr, {
        bearing: 60, pitch: 50, roll: 0, padding: {top: 0, bottom: 0, left: 0, right: 0},
        offsetAsPoint: new Point(0, 0), center: new LngLat(-73.5, 41), zoom: 13.5,
    });
    for (let i = 0; i <= 100; i++) easeFunc(i / 100);
});
