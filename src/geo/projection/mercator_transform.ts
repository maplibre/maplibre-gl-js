import {Transform, type TransformOptions} from '../transform.ts';

/**
 * Creates a transform for the mercator projection, or for a registered CRS with that CRS's world coordinate helper.
 */
export function createMercatorTransform(options?: TransformOptions): Transform {
    return new Transform('mercator', options);
}
