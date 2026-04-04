// Hillshade shader — Pass 2: Render shaded terrain from prepared slope texture
// Implements the "standard" hillshade illumination model matching GL JS and native.

struct HillshadeDrawableUBO {
    matrix: mat4x4<f32>,
    latrange: vec2<f32>,
    exaggeration: f32,
    pad1: f32,
    tex_offset: vec2<f32>,   // UV offset for overscaled sub-tile
    tex_scale: vec2<f32>,    // UV scale for overscaled sub-tile
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
    // Apply sub-tile offset/scale for overscaled tiles, then flip Y
    // WebGPU framebuffer origin is top-left, so slope texture is Y-flipped vs GL
    var uv = texcoord / 8192.0 * drawable.tex_scale + drawable.tex_offset;
    uv.y = 1.0 - uv.y;
    vout.v_pos = uv;

    return vout;
}

struct FragmentInput {
    @location(0) v_pos: vec2<f32>,
};

@group(1) @binding(0) var slope_sampler: sampler;
@group(1) @binding(1) var slope_texture: texture_2d<f32>;

const PI: f32 = 3.141592653589793;

fn glMod(x: f32, y: f32) -> f32 {
    return x - y * floor(x / y);
}

fn get_aspect(deriv: vec2<f32>) -> f32 {
    let aspectDefault = 0.5 * PI * select(-1.0, 1.0, deriv.y > 0.0);
    return select(aspectDefault, atan2(deriv.y, -deriv.x), deriv.x != 0.0);
}

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let drawable = drawableVector[globalIndex.value];
    // Reference paintParams to prevent binding from being stripped
    let dummy_pr = paintParams.pixel_ratio;

    // Sample the prepared slope texture
    let pixel = textureSample(slope_texture, slope_sampler, fin.v_pos);

    // Latitude correction for Mercator distortion (see maplibre-gl-js #4807)
    // v_pos.y is already flipped in vertex shader, so use directly (matches native)
    let latRange = drawable.latrange;
    let latitude = (latRange.x - latRange.y) * fin.v_pos.y + latRange.y;
    let scaleFactor = cos(radians(latitude));

    // Decode derivative from prepared texture: stored as deriv/8 + 0.5
    let deriv = ((pixel.rg * 8.0) - vec2<f32>(4.0, 4.0)) / scaleFactor;

    // Standard hillshade illumination (MapLibre's default method)
    let azimuth = props.azimuth + PI;
    let slope = atan(0.625 * length(deriv));
    let aspect = get_aspect(deriv);

    let intensity = drawable.exaggeration;

    // Exponential slope scaling based on intensity
    let base = 1.875 - intensity * 1.75;
    let maxValue = 0.5 * PI;
    let denom = pow(base, maxValue) - 1.0;
    let useNonLinear = abs(intensity - 0.5) > 1e-6;
    let scaledSlope = select(slope, ((pow(base, slope) - 1.0) / denom) * maxValue, useNonLinear);

    // Accent color from slope cosine
    let accentFactor = cos(scaledSlope);
    let accentColor = (1.0 - accentFactor) * props.accent * clamp(intensity * 2.0, 0.0, 1.0);

    // Shade color from aspect relative to light direction
    let shade = abs(glMod((aspect + azimuth) / PI + 0.5, 2.0) - 1.0);
    let shadeColor = mix(props.shadow, props.highlight, shade) * sin(scaledSlope) * clamp(intensity * 2.0, 0.0, 1.0);

    return accentColor * (1.0 - shadeColor.a) + shadeColor;
}
