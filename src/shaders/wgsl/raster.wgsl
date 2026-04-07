struct RasterDrawableUBO {
    matrix: mat4x4<f32>,
};

struct RasterEvaluatedPropsUBO {
    spin_weights: vec4<f32>,
    tl_parent: vec2<f32>,
    scale_parent: f32,
    buffer_scale: f32,
    fade_t: f32,
    opacity: f32,
    brightness_low: f32,
    brightness_high: f32,
    saturation_factor: f32,
    contrast_factor: f32,
    pad1: f32,
    pad2: f32,
};

struct GlobalIndexUBO {
    value: u32,
    pad0: vec3<u32>,
};

@group(0) @binding(1) var<uniform> globalIndex: GlobalIndexUBO;
@group(0) @binding(2) var<storage, read> drawableVector: array<RasterDrawableUBO>;
@group(0) @binding(4) var<uniform> props: RasterEvaluatedPropsUBO;

// VertexInput is generated dynamically in JS

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) pos0: vec2<f32>,
    @location(1) pos1: vec2<f32>,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];
    let clip = drawable.matrix * vec4<f32>(f32(vin.pos.x), f32(vin.pos.y), 0.0, 1.0);
    vout.position = clip;
    vout.position.z = (vout.position.z + vout.position.w) * 0.5;

    // Tile mesh only has a_pos — use it for both position and texture coords
    let tex = vec2<f32>(f32(vin.pos.x), f32(vin.pos.y));
    let pos0 = (((tex / 8192.0) - vec2<f32>(0.5, 0.5)) / props.buffer_scale) + vec2<f32>(0.5, 0.5);
    vout.pos0 = pos0;
    vout.pos1 = pos0 * props.scale_parent + props.tl_parent;

    return vout;
}

struct FragmentInput {
    @location(0) pos0: vec2<f32>,
    @location(1) pos1: vec2<f32>,
};

@group(1) @binding(0) var texture_sampler: sampler;
@group(1) @binding(1) var image0: texture_2d<f32>;
@group(1) @binding(2) var image1: texture_2d<f32>;

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    var color0 = textureSample(image0, texture_sampler, fin.pos0);
    var color1 = textureSample(image1, texture_sampler, fin.pos1);

    if (color0.a > 0.0) {
        color0 = vec4<f32>(color0.rgb / color0.a, color0.a);
    }
    if (color1.a > 0.0) {
        color1 = vec4<f32>(color1.rgb / color1.a, color1.a);
    }

    var color = mix(color0, color1, props.fade_t);
    color.a = color.a * props.opacity;
    var rgb = color.rgb;

    let spin = props.spin_weights;
    rgb = vec3<f32>(dot(rgb, spin.xyz),
                    dot(rgb, spin.zxy),
                    dot(rgb, spin.yzx));

    let average = (color.r + color.g + color.b) / 3.0;
    rgb = rgb + (average - rgb) * props.saturation_factor;
    rgb = (rgb - vec3<f32>(0.5, 0.5, 0.5)) * props.contrast_factor + vec3<f32>(0.5, 0.5, 0.5);

    let high_vec = vec3<f32>(props.brightness_low, props.brightness_low, props.brightness_low);
    let low_vec = vec3<f32>(props.brightness_high, props.brightness_high, props.brightness_high);

    let final_rgb = mix(high_vec, low_vec, rgb) * color.a;
    return vec4<f32>(final_rgb, color.a);
}
