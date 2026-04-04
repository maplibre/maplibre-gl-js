// Hillshade shader — Pass 2: Render shaded terrain from prepared slope texture

struct HillshadeDrawableUBO {
    matrix: mat4x4<f32>,
    latrange: vec2<f32>,
    exaggeration: f32,
    pad1: f32,
};

struct HillshadePropsUBO {
    shadow: vec4<f32>,
    highlight: vec4<f32>,
    accent: vec4<f32>,
    altitude: f32,
    azimuth: f32,
    pad1: f32,
    pad2: f32,
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
@group(0) @binding(2) var<storage, read> drawableVector: array<HillshadeDrawableUBO>;
@group(0) @binding(4) var<uniform> props: HillshadePropsUBO;

// VertexInput is generated dynamically in JS

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) v_pos: vec2<f32>,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];

    let pos = vec2<f32>(f32(vin.pos.x), f32(vin.pos.y));
    vout.position = drawable.matrix * vec4<f32>(pos, 0.0, 1.0);
    vout.position.z = (vout.position.z + vout.position.w) * 0.5;

    let texcoord = vec2<f32>(f32(vin.texture_pos.x), f32(vin.texture_pos.y));
    vout.v_pos = texcoord / 8192.0;

    return vout;
}

struct FragmentInput {
    @location(0) v_pos: vec2<f32>,
};

@group(1) @binding(0) var slope_sampler: sampler;
@group(1) @binding(1) var slope_texture: texture_2d<f32>;

const PI: f32 = 3.141592653589793;

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let drawable = drawableVector[globalIndex.value];
    // Reference paintParams to prevent it from being stripped
    let dummy_pr = paintParams.pixel_ratio;

    // Sample the prepared slope texture
    let slopes = textureSample(slope_texture, slope_sampler, fin.v_pos);
    let dzdx = (slopes.r - 0.5) * 2.0;
    let dzdy = (slopes.g - 0.5) * 2.0;

    // Compute slope and aspect
    let slope_val = atan(sqrt(dzdx * dzdx + dzdy * dzdy));
    let aspect = atan2(-dzdy, dzdx);

    // Light direction
    let azimuth = props.azimuth;
    let altitude = props.altitude;

    // Standard hillshade: dot product of light direction and surface normal
    let hillshade = cos(altitude) * cos(slope_val) +
        sin(altitude) * sin(slope_val) * cos(azimuth - aspect);

    // Map to shadow/highlight
    let shadow = props.shadow;
    let highlight = props.highlight;
    var color = mix(shadow, highlight, clamp(hillshade, 0.0, 1.0));

    // Blend accent color based on slope
    let accent_amount = min(slope_val * 2.0, 1.0) * 0.5;
    color = mix(color, props.accent, accent_amount);

    return vec4<f32>(color.rgb * color.a, color.a);
}
