import {Transform, type TransformOptions} from '../transform.ts';

/**
 * Creates a transform for the globe projection, which starts fully a globe.
 */
export function createGlobeTransform(options?: TransformOptions): Transform {
    return new Transform('globe', options);
}
