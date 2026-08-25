// @vitest-environment jsdom

import {bench, describe} from 'vitest';
import {LngLat} from '../geo/lng_lat.ts';
import {coveringTiles} from '../geo/projection/covering_tiles.ts';
import {GlobeTransform} from '../geo/projection/globe_transform.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import type {ITransform} from '../geo/transform_interface.ts';
import {createNullGL} from '../util/test/null_gl.ts';
import {Painter} from './painter.ts';

const FRAMES = 60;

function setup(projection: 'mercator' | 'globe') {
    const transform: ITransform = projection === 'globe' ? new GlobeTransform() : new MercatorTransform();
    transform.resize(1024, 768, true);
    transform.setZoom(12);
    transform.setCenter(new LngLat(11.4, 48.1));
    transform.setPitch(45);
    const painter = new Painter(createNullGL(), transform);
    painter.style = {map: {}} as any;
    return {transform, painter};
}

for (const projection of ['mercator', 'globe'] as const) {
    for (const moving of [false, true]) {
        const base = setup(projection);
        const raw = setup(projection);
        const cached = setup(projection);

        const lookupsPerFrame = projection === 'globe' ? 2 : 1;

        // Mirrors Map._render, which calls setTransitionState every frame and so
        // rebuilds the globe matrix whether or not the camera moved.
        const frame = ({transform}: {transform: ITransform}, i: number) => {
            if (moving) transform.setZoom(12 + i * 0.01);
            transform.setTransitionState(1);
        };

        describe(`${projection}, camera ${moving ? 'moving' : 'still'}`, () => {
            // Subtract this from the two below: on globe the per-frame matrix rebuild
            // costs more than the lookup and is untouched by the painter.
            bench('frame only', () => {
                for (let i = 0; i < FRAMES; i++) {
                    frame(base, i);
                }
            });

            bench('coveringTiles every frame', () => {
                for (let i = 0; i < FRAMES; i++) {
                    frame(raw, i);
                    for (let j = 0; j < lookupsPerFrame; j++) {
                        coveringTiles(raw.transform, {tileSize: raw.transform.tileSize});
                    }
                }
            });

            bench('painter cache', () => {
                for (let i = 0; i < FRAMES; i++) {
                    frame(cached, i);
                    for (let j = 0; j < lookupsPerFrame; j++) {
                        cached.painter.getViewportCoveringTiles();
                    }
                }
            });
        });
    }
}
