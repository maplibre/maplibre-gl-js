import {UBO_BINDINGS, UniformBuffer, std140Layout} from './uniform_buffer.ts';
import type {Context} from './context.ts';
import type {Painter} from '../render/painter.ts';

const layout = std140Layout([
    {name: 'u_units_to_pixels', type: 'vec2'},
    {name: 'u_world_size', type: 'vec2'},
    {name: 'u_camera_to_center_distance', type: 'float'},
    {name: 'u_symbol_fade_change', type: 'float'},
    {name: 'u_aspect_ratio', type: 'float'},
    {name: 'u_device_pixel_ratio', type: 'float'},
    {name: 'u_viewport_size', type: 'vec2'},
    {name: 'u_pixel_extrude_scale', type: 'vec2'},
    {name: 'u_pitch', type: 'float'},
]);
const offsets = layout.offsets;

/**
 * @internal
 * The buffer behind the `FrameUBO` block in the shader preludes, written once per frame by `Painter.render`.
 */
export function createFrameUniformBuffer(context: Context): UniformBuffer {
    return new UniformBuffer(context, UBO_BINDINGS.FrameUBO, layout);
}

export function updateFrameUniformBuffer(buffer: UniformBuffer, painter: Painter): void {
    const f32 = buffer.pending;
    const {transform} = painter;
    const gl = painter.context.gl;
    f32[offsets.u_units_to_pixels] = 1 / transform.pixelsToGLUnits[0];
    f32[offsets.u_units_to_pixels + 1] = 1 / transform.pixelsToGLUnits[1];
    f32[offsets.u_world_size] = gl.drawingBufferWidth;
    f32[offsets.u_world_size + 1] = gl.drawingBufferHeight;
    f32[offsets.u_camera_to_center_distance] = transform.cameraToCenterDistance;
    f32[offsets.u_symbol_fade_change] = painter.options.fadeDuration ? painter.symbolFadeChange : 1;
    f32[offsets.u_aspect_ratio] = transform.width / transform.height;
    f32[offsets.u_device_pixel_ratio] = painter.pixelRatio;
    f32[offsets.u_viewport_size] = transform.width;
    f32[offsets.u_viewport_size + 1] = transform.height;
    f32[offsets.u_pixel_extrude_scale] = 1 / transform.width;
    f32[offsets.u_pixel_extrude_scale + 1] = 1 / transform.height;
    f32[offsets.u_pitch] = transform.pitch / 360 * 2 * Math.PI;
    buffer.upload();
}
