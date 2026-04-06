// Heatmap Texture shader — Pass 2: Color ramp composite
// Samples the kernel density FBO and maps through a color ramp texture.
// Reference: maplibre-native heatmap_texture.hpp (webgpu)

struct HeatmapTextureUBO {
    matrix: mat4x4<f32>,
    world: vec2<f32>,
    opacity: f32,
    pad1: f32,
};

@group(0) @binding(2) var<storage, read> drawableVector: array<HeatmapTextureUBO>;

struct GlobalIndexUBO {
    value: u32,
    pad0: vec3<u32>,
};

@group(0) @binding(1) var<uniform> globalIndex: GlobalIndexUBO;

// VertexInput is generated dynamically in JS

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) v_pos: vec2<f32>,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let ubo = drawableVector[globalIndex.value];

    let quad_pos = vec2<f32>(f32(vin.pos.x), f32(vin.pos.y));
    vout.position = ubo.matrix * vec4<f32>(quad_pos * ubo.world, 0.0, 1.0);
    // Remap z
    vout.position.z = (vout.position.z + vout.position.w) * 0.5;

    vout.v_pos = vec2<f32>(quad_pos.x, quad_pos.y);

    return vout;
}

struct FragmentInput {
    @location(0) v_pos: vec2<f32>,
};

@group(1) @binding(0) var tex_sampler: sampler;
@group(1) @binding(1) var heatmap_texture: texture_2d<f32>;
@group(1) @binding(2) var color_ramp_texture: texture_2d<f32>;

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let ubo = drawableVector[globalIndex.value];
    let t = textureSample(heatmap_texture, tex_sampler, fin.v_pos).r;
    let color = textureSample(color_ramp_texture, tex_sampler, vec2<f32>(t, 0.5));
    return color * ubo.opacity;
}
