struct CircleDrawableUBO {
    matrix: mat4x4<f32>,
    extrude_scale: vec2<f32>,
    color_t: f32,
    radius_t: f32,
    blur_t: f32,
    opacity_t: f32,
    stroke_color_t: f32,
    stroke_width_t: f32,
    stroke_opacity_t: f32,
    pad1: f32,
    pad2: f32,
    pad3: f32,
};

fn glMod2v(x: vec2<f32>, y: vec2<f32>) -> vec2<f32> {
    return x - y * floor(x / y);
}

fn unpack_mix_float(packedValue: vec2<f32>, t: f32) -> f32 {
    return mix(packedValue.x, packedValue.y, t);
}

fn unpack_float(packedValue: f32) -> vec2<f32> {
    let packedIntValue = i32(packedValue);
    let v0 = packedIntValue / 256;
    return vec2<f32>(f32(v0), f32(packedIntValue - v0 * 256));
}

fn decode_color(encodedColor: vec2<f32>) -> vec4<f32> {
    return vec4<f32>(
        unpack_float(encodedColor.x) / 255.0,
        unpack_float(encodedColor.y) / 255.0
    );
}

fn unpack_mix_color(packedColors: vec4<f32>, t: f32) -> vec4<f32> {
    let minColor = decode_color(vec2<f32>(packedColors.x, packedColors.y));
    let maxColor = decode_color(vec2<f32>(packedColors.z, packedColors.w));
    return mix(minColor, maxColor, t);
}

struct CircleEvaluatedPropsUBO {
    color: vec4<f32>,
    stroke_color: vec4<f32>,
    radius: f32,
    blur: f32,
    opacity: f32,
    stroke_width: f32,
    stroke_opacity: f32,
    scale_with_map: i32,
    pitch_with_map: i32,
    pad1: f32,
};

struct GlobalPaintParamsUBO {
    pattern_atlas_texsize: vec2<f32>,
    units_to_pixels: vec2<f32>,
    world_size: vec2<f32>,
    camera_to_center_distance: f32,
    symbol_fade_change: f32,
    aspect_ratio: f32,
    pixel_ratio: f32,
    map_zoom: f32,
    pad1: f32,
};

struct GlobalIndexUBO {
    value: u32,
    pad0: vec3<u32>,
};

@group(0) @binding(0) var<uniform> paintParams: GlobalPaintParamsUBO;
@group(0) @binding(1) var<uniform> globalIndex: GlobalIndexUBO;
@group(0) @binding(2) var<storage, read> drawableVector: array<CircleDrawableUBO>;
@group(0) @binding(4) var<uniform> props: CircleEvaluatedPropsUBO;

// VertexInput is generated dynamically in JS

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) extrude: vec2<f32>,
    @location(1) circle_data: vec4<f32>,
    @location(2) color: vec4<f32>,
    @location(3) stroke_color: vec4<f32>,
    @location(4) stroke_data: vec2<f32>,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;

    let drawable = drawableVector[globalIndex.value];
    let scale_with_map = props.scale_with_map != 0;
    let pitch_with_map = props.pitch_with_map != 0;

    // Unpack position: undo VERTEX_MIN_VALUE offset (-32768), then extract extrude and center
    let pos_raw = vec2<f32>(f32(vin.pos.x), f32(vin.pos.y)) + vec2<f32>(32768.0);
    let extrude = glMod2v(pos_raw, vec2<f32>(8.0)) / 7.0 * 2.0 - vec2<f32>(1.0, 1.0);
    let scaled_extrude = extrude * drawable.extrude_scale;
    let circle_center = floor(pos_raw / 8.0);

    var color = props.color;
#ifdef HAS_DATA_DRIVEN_u_color
    color = decode_color(vin.color);
#endif
#ifdef HAS_COMPOSITE_u_color
    color = unpack_mix_color(vin.color, drawable.color_t);
#endif

    var radius = props.radius;
#ifdef HAS_DATA_DRIVEN_u_radius
    radius = vin.radius;
#endif
#ifdef HAS_COMPOSITE_u_radius
    radius = unpack_mix_float(vin.radius, drawable.radius_t);
#endif

    var blur = props.blur;
#ifdef HAS_DATA_DRIVEN_u_blur
    blur = vin.blur;
#endif
#ifdef HAS_COMPOSITE_u_blur
    blur = unpack_mix_float(vin.blur, drawable.blur_t);
#endif

    var opacity = props.opacity;
#ifdef HAS_DATA_DRIVEN_u_opacity
    opacity = vin.opacity;
#endif
#ifdef HAS_COMPOSITE_u_opacity
    opacity = unpack_mix_float(vin.opacity, drawable.opacity_t);
#endif

    var stroke_color = props.stroke_color;
#ifdef HAS_DATA_DRIVEN_u_stroke_color
    stroke_color = decode_color(vin.stroke_color);
#endif
#ifdef HAS_COMPOSITE_u_stroke_color
    stroke_color = unpack_mix_color(vin.stroke_color, drawable.stroke_color_t);
#endif

    var stroke_width = props.stroke_width;
#ifdef HAS_DATA_DRIVEN_u_stroke_width
    stroke_width = vin.stroke_width;
#endif
#ifdef HAS_COMPOSITE_u_stroke_width
    stroke_width = unpack_mix_float(vin.stroke_width, drawable.stroke_width_t);
#endif

    var stroke_opacity = props.stroke_opacity;
#ifdef HAS_DATA_DRIVEN_u_stroke_opacity
    stroke_opacity = vin.stroke_opacity;
#endif
#ifdef HAS_COMPOSITE_u_stroke_opacity
    stroke_opacity = unpack_mix_float(vin.stroke_opacity, drawable.stroke_opacity_t);
#endif

    let radius_with_stroke = radius + stroke_width;

    var position: vec4<f32>;
    if (pitch_with_map) {
        var corner_position = circle_center;
        if (scale_with_map) {
            corner_position += scaled_extrude * radius_with_stroke;
        } else {
            let projected_center = drawable.matrix * vec4<f32>(circle_center, 0.0, 1.0);
            corner_position += scaled_extrude * radius_with_stroke *
                               (projected_center.w / paintParams.camera_to_center_distance);
        }
        position = drawable.matrix * vec4<f32>(corner_position, 0.0, 1.0);
    } else {
        position = drawable.matrix * vec4<f32>(circle_center, 0.0, 1.0);
        var factor = position.w;
        if (scale_with_map) {
            factor = paintParams.camera_to_center_distance;
        }
        let delta = scaled_extrude * radius_with_stroke * factor;
        position = vec4<f32>(position.x + delta.x, position.y + delta.y, position.z, position.w);
    }

    let antialiasblur = 1.0 / max(paintParams.pixel_ratio * radius_with_stroke, 1e-6);

    // Remap z from WebGL NDC [-1,1] to WebGPU NDC [0,1]
    position = vec4<f32>(position.x, position.y, (position.z + position.w) * 0.5, position.w);
    vout.position = position;
    vout.extrude = extrude;
    vout.circle_data = vec4<f32>(antialiasblur, radius, blur, opacity);
    vout.color = color;
    vout.stroke_color = stroke_color;
    vout.stroke_data = vec2<f32>(stroke_width, stroke_opacity);

    return vout;
}

struct FragmentInput {
    @location(0) extrude: vec2<f32>,
    @location(1) circle_data: vec4<f32>,
    @location(2) color: vec4<f32>,
    @location(3) stroke_color: vec4<f32>,
    @location(4) stroke_data: vec2<f32>,
};

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let extrude_length = length(fin.extrude);
    let antialiasblur = fin.circle_data.x;
    let radius = fin.circle_data.y;
    let blur = fin.circle_data.z;
    let opacity = fin.circle_data.w;
    let stroke_width = fin.stroke_data.x;
    let stroke_opacity = fin.stroke_data.y;
    let antialiased_blur = -max(blur, antialiasblur);

    let opacity_t = smoothstep(0.0, antialiased_blur, extrude_length - 1.0);

    var color_t: f32;
    if (stroke_width < 0.01) {
        color_t = 0.0;
    } else {
        color_t = smoothstep(antialiased_blur, 0.0, extrude_length - radius / (radius + stroke_width));
    }

    let final_color = mix(fin.color * opacity, fin.stroke_color * stroke_opacity, color_t);
    return opacity_t * final_color;
}
