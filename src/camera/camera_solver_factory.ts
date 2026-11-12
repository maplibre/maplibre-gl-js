import {renderedProjection} from './camera_context.ts';
import {MercatorCameraSolver} from './mercator_camera_solver.ts';
import {VerticalPerspectiveCameraSolver} from './vertical_perspective_camera_solver.ts';

import type {CameraContext} from './camera_context.ts';
import type {CameraSolver} from './camera_solver.ts';

/** The solver of each projection holds nothing, so every camera that renders with a projection shares one. */
const mercatorCameraSolver = new MercatorCameraSolver();
const verticalPerspectiveCameraSolver = new VerticalPerspectiveCameraSolver();

/** @internal The {@link CameraSolver} of the projection a camera in a context renders with, see {@link renderedProjection}. */
export function getCameraSolver(context: CameraContext): CameraSolver {
    switch (renderedProjection(context)) {
        case 'mercator': return mercatorCameraSolver;
        case 'vertical-perspective': return verticalPerspectiveCameraSolver;
    }
}
