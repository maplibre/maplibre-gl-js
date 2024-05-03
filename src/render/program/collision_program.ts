import {Uniform1f, Uniform2f, UniformMatrix4f} from '../uniform_binding';
import type {Context} from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type {Transform} from '../../geo/transform';
import {mat4} from 'gl-matrix';

export type CollisionUniformsType = {
    'u_matrix': UniformMatrix4f;
    'u_pixel_extrude_scale': Uniform2f;
};

export type CollisionCircleUniformsType = {
    'u_matrix': UniformMatrix4f;
    'u_inv_matrix': UniformMatrix4f;
    'u_camera_to_center_distance': Uniform1f;
    'u_viewport_size': Uniform2f;
};

const collisionUniforms = (context: Context, locations: UniformLocations): CollisionUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_pixel_extrude_scale': new Uniform2f(context, locations.u_pixel_extrude_scale)
});

const collisionCircleUniforms = (context: Context, locations: UniformLocations): CollisionCircleUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_inv_matrix': new UniformMatrix4f(context, locations.u_inv_matrix),
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_viewport_size': new Uniform2f(context, locations.u_viewport_size)
});

const collisionUniformValues = (transform: {width: number; height: number}, matrix: mat4): UniformValues<CollisionUniformsType> => {
    return {
        'u_matrix': matrix,
        'u_pixel_extrude_scale': [1.0 / transform.width, 1.0 / transform.height],
    };
};

const collisionCircleUniformValues = (matrix: mat4, invMatrix: mat4, transform: Transform): UniformValues<CollisionCircleUniformsType> => {
    return {
        'u_matrix': matrix,
        'u_inv_matrix': invMatrix,
        'u_camera_to_center_distance': transform.cameraToCenterDistance,
        'u_viewport_size': [transform.width, transform.height]
    };
};

export {collisionUniforms, collisionUniformValues, collisionCircleUniforms, collisionCircleUniformValues};
