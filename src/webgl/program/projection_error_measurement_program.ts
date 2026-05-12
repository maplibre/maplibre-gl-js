import {Uniform1f} from '../uniform_binding.ts';
import type {Context} from '../../webgl/context.ts';
import type {UniformValues, UniformLocations} from '../uniform_binding.ts';

export type ProjectionErrorMeasurementUniformsType = {
    'u_input': Uniform1f;
    'u_output_expected': Uniform1f;
};

const projectionErrorMeasurementUniforms = (context: Context, locations: UniformLocations): ProjectionErrorMeasurementUniformsType => ({
    'u_input': new Uniform1f(context, locations.u_input),
    'u_output_expected': new Uniform1f(context, locations.u_output_expected),
});

const projectionErrorMeasurementUniformValues = (
    input: number,
    outputExpected: number
): UniformValues<ProjectionErrorMeasurementUniformsType> => ({
    'u_input': input,
    'u_output_expected': outputExpected,
});

export {projectionErrorMeasurementUniforms, projectionErrorMeasurementUniformValues};
