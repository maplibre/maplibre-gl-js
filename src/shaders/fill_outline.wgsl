struct FillOutlineDrawableUBO {
    matrix: mat4x4<f32>,
    outline_color_t: f32,
    opacity_t: f32,
    pad1: f32,
    pad2: f32,
};

struct FillOutlinePropsUBO {
    color: vec4<f32>,
    outline_color: vec4<f32>,
    opacity: f32,
    fade: f32,
    from_scale: f32,
    to_scale: f32,
};

struct GlobalIndexUBO {
    value: u32,
    pad0: vec3<u32>,
};

@group(0) @binding(1) var<uniform> globalIndex: GlobalIndexUBO;
@group(0) @binding(2) var<storage, read> drawableVector: array<FillOutlineDrawableUBO>;
@group(0) @binding(4) var<uniform> props: FillOutlinePropsUBO;

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

fn unpack_mix_float(packedValue: vec2<f32>, t: f32) -> f32 {
    return mix(packedValue.x, packedValue.y, t);
}

// VertexInput is generated dynamically in JS

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) frag_color: vec4<f32>,
    @location(1) frag_opacity: f32,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];
    let pos = vec2<f32>(f32(vin.pos.x), f32(vin.pos.y));
    let clip = drawable.matrix * vec4<f32>(pos, 0.0, 1.0);
    vout.position = clip;
    // Remap z from WebGL NDC [-1,1] to WebGPU NDC [0,1]
    vout.position.z = (vout.position.z + vout.position.w) * 0.5;

    var color = props.outline_color;
#ifdef HAS_DATA_DRIVEN_u_outline_color
    color = decode_color(vin.outline_color);
#endif
#ifdef HAS_COMPOSITE_u_outline_color
    color = unpack_mix_color(vin.outline_color, drawable.outline_color_t);
#endif

    var opacity = props.opacity;
#ifdef HAS_DATA_DRIVEN_u_opacity
    opacity = vin.opacity;
#endif
#ifdef HAS_COMPOSITE_u_opacity
    opacity = unpack_mix_float(vin.opacity, drawable.opacity_t);
#endif

    vout.frag_color = color;
    vout.frag_opacity = opacity;
    return vout;
}

struct FragmentInput {
    @location(0) frag_color: vec4<f32>,
    @location(1) frag_opacity: f32,
};

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    // Output opaque outline color (matching native WebGPU approach)
    return fin.frag_color * fin.frag_opacity;
}
