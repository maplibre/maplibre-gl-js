// Heatmap shader — Pass 1: Kernel density estimation
// Renders point features as Gaussian kernels with additive blending to an offscreen FBO.
// Reference: maplibre-native heatmap.hpp (webgpu)

const ZERO: f32 = 1.0 / 255.0 / 16.0;
const GAUSS_COEF: f32 = 0.3989422804014327;

struct HeatmapDrawableUBO {
    matrix: mat4x4<f32>,
    extrude_scale: f32,
    weight_t: f32,
    radius_t: f32,
    pad1: f32,
};

struct HeatmapPropsUBO {
    weight: f32,
    radius: f32,
    intensity: f32,
    pad1: f32,
};

struct GlobalIndexUBO {
    value: u32,
    pad0: vec3<u32>,
};

@group(0) @binding(1) var<uniform> globalIndex: GlobalIndexUBO;
@group(0) @binding(2) var<storage, read> drawableVector: array<HeatmapDrawableUBO>;
@group(0) @binding(4) var<uniform> props: HeatmapPropsUBO;

// VertexInput is generated dynamically in JS

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) v_weight: f32,
    @location(1) v_extrude: vec2<f32>,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];

    let weight = props.weight;
    let radius = props.radius;

    // Decode position and extrusion from packed data
    // Encoding: a_pos = -32768 + point*8 + extrude (extrude 0-7)
    let pos_raw = vec2<f32>(f32(vin.pos.x) + 32768.0, f32(vin.pos.y) + 32768.0);
    let unscaled_extrude = vec2<f32>(
        (pos_raw.x % 8.0) / 7.0 * 2.0 - 1.0,
        (pos_raw.y % 8.0) / 7.0 * 2.0 - 1.0
    );

    // Gaussian kernel size from weight and intensity
    let S = sqrt(-2.0 * log(ZERO / (max(weight, ZERO) * max(props.intensity, ZERO) * GAUSS_COEF))) / 3.0;
    let extrude = S * unscaled_extrude;
    let scaled_extrude = extrude * radius * drawable.extrude_scale;

    let base = floor(pos_raw / 8.0);
    vout.position = drawable.matrix * vec4<f32>(base + scaled_extrude, 0.0, 1.0);
    // Remap z from WebGL NDC [-1,1] to WebGPU NDC [0,1]
    vout.position.z = (vout.position.z + vout.position.w) * 0.5;

    vout.v_weight = weight;
    vout.v_extrude = extrude;

    return vout;
}

struct FragmentInput {
    @location(0) v_weight: f32,
    @location(1) v_extrude: vec2<f32>,
};

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let d = -0.5 * 3.0 * 3.0 * dot(fin.v_extrude, fin.v_extrude);
    let val = fin.v_weight * props.intensity * GAUSS_COEF * exp(d);
    return vec4<f32>(val, 1.0, 1.0, 1.0);
}
