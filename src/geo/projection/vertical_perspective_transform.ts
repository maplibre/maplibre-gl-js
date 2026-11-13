import {Transform, type TransformOptions} from '../transform.ts';

/**
 * Creates a transform for the vertical perspective projection.
 */
export function createVerticalPerspectiveTransform(options?: TransformOptions): Transform {
    return new Transform('vertical-perspective', options);
}
