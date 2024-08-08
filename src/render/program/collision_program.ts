import {Uniform2f} from '../uniform_binding';
import type {Context} from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type {IReadonlyTransform} from '../../geo/transform_interface';

export type CollisionUniformsType = {
    'u_pixel_extrude_scale': Uniform2f;
};

export type CollisionCircleUniformsType = {
    'u_viewport_size': Uniform2f;
};

const collisionUniforms = (context: Context, locations: UniformLocations): CollisionUniformsType => ({
    'u_pixel_extrude_scale': new Uniform2f(context, locations.u_pixel_extrude_scale)
});

const collisionCircleUniforms = (context: Context, locations: UniformLocations): CollisionCircleUniformsType => ({
    'u_viewport_size': new Uniform2f(context, locations.u_viewport_size)
});

const collisionUniformValues = (transform: {width: number; height: number}): UniformValues<CollisionUniformsType> => {
    return {
        'u_pixel_extrude_scale': [1.0 / transform.width, 1.0 / transform.height],
    };
};

const collisionCircleUniformValues = (transform: IReadonlyTransform): UniformValues<CollisionCircleUniformsType> => {
    return {
        'u_viewport_size': [transform.width, transform.height]
    };
};

export {collisionUniforms, collisionUniformValues, collisionCircleUniforms, collisionCircleUniformValues};
