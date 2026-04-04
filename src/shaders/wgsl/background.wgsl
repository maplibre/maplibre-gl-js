struct BackgroundDrawableUBO {
    matrix: mat4x4<f32>,
};

struct BackgroundPropsUBO {
    color: vec4<f32>,
    opacity: f32,
    pad1: f32,
    pad2: f32,
    pad3: f32,
};

struct GlobalIndexUBO {
    value: u32,
    pad0: vec3<u32>,
};

@group(0) @binding(1) var<uniform> globalIndex: GlobalIndexUBO;
@group(0) @binding(2) var<storage, read> drawableVector: array<BackgroundDrawableUBO>;
@group(0) @binding(4) var<uniform> props: BackgroundPropsUBO;

// VertexInput is generated dynamically in JS

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];
    let pos = vec2<f32>(f32(vin.pos.x), f32(vin.pos.y));
    vout.position = drawable.matrix * vec4<f32>(pos, 0.0, 1.0);
    // Remap z from WebGL NDC [-1,1] to WebGPU NDC [0,1]
    vout.position.z = (vout.position.z + vout.position.w) * 0.5;
    return vout;
}

@fragment
fn fragmentMain() -> @location(0) vec4<f32> {
    return props.color * props.opacity;
}
