// Line SDF shader — dashed line rendering using signed distance field textures
// Ported from line_sdf.vertex.glsl + line_sdf.fragment.glsl
// SDF texture sampling is stubbed out — fragment outputs solid line color for now

// floor(127 / 2) == 63.0 → scale = 1/63
const LINE_SCALE: f32 = 0.015873016;

// We scale the distance before adding it to the buffers so that we can store
// long distances for long segments. Use this value to unscale the distance.
const LINE_DISTANCE_SCALE: f32 = 2.0;

// Helper functions for data-driven property unpacking

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

fn unpack_mix_float(packedValue: vec2<f32>, t: f32) -> f32 {
    return mix(packedValue.x, packedValue.y, t);
}

fn unpack_mix_color(packedColors: vec4<f32>, t: f32) -> vec4<f32> {
    let minColor = decode_color(vec2<f32>(packedColors.x, packedColors.y));
    let maxColor = decode_color(vec2<f32>(packedColors.z, packedColors.w));
    return mix(minColor, maxColor, t);
}

// UBO: per-drawable data (stored in a storage buffer, indexed by globalIndex)
struct LineSDFDrawableUBO {
    matrix: mat4x4<f32>,          // 64 bytes
    patternscale_a: vec2<f32>,    // 8 bytes
    patternscale_b: vec2<f32>,    // 8 bytes
    tex_y_a: f32,                 // 4 bytes
    tex_y_b: f32,                 // 4 bytes
    ratio: f32,                   // 4 bytes  — 1/pixelsToTileUnits
    device_pixel_ratio: f32,      // 4 bytes
    units_to_pixels: vec2<f32>,   // 8 bytes  — transform.pixelsToGLUnits
    sdfgamma: f32,                // 4 bytes
    mix_value: f32,               // 4 bytes  — crossfade mix factor
    color_t: f32,                 // 4 bytes
    blur_t: f32,                  // 4 bytes
    opacity_t: f32,               // 4 bytes
    gapwidth_t: f32,              // 4 bytes
    offset_t: f32,                // 4 bytes
    width_t: f32,                 // 4 bytes
    floorwidth_t: f32,            // 4 bytes
    pad1: f32,                    // 4 bytes  — padding to 16-byte alignment
    pad2: f32,                    // 4 bytes
    pad3: f32,                    // 4 bytes
};

// UBO: evaluated paint properties (uniforms for non-data-driven values)
struct LineSDFPropsUBO {
    color: vec4<f32>,
    blur: f32,
    opacity: f32,
    gapwidth: f32,
    offset: f32,
    width: f32,
    floorwidth: f32,
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
@group(0) @binding(2) var<storage, read> drawableVector: array<LineSDFDrawableUBO>;
@group(0) @binding(4) var<uniform> props: LineSDFPropsUBO;

// VertexInput is generated dynamically in JS
// Expected attributes:
//   @location(0) pos_normal: vec2<i32>   — a_pos_normal (Int16 x2)
//   @location(1) data: vec4<u32>         — a_data (Uint8 x4)
// Data-driven attributes (when present):
//   @location(2) color: vec4<f32>        — packed color (for HAS_DATA_DRIVEN / HAS_COMPOSITE)
//   @location(3) blur: vec2<f32>         — packed blur
//   @location(4) opacity: vec2<f32>      — packed opacity
//   @location(5) gapwidth: vec2<f32>     — packed gapwidth
//   @location(6) offset: vec2<f32>       — packed offset
//   @location(7) width: vec2<f32>        — packed width
//   @location(8) floorwidth: vec2<f32>   — packed floorwidth

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) v_normal: vec2<f32>,
    @location(1) v_width2: vec2<f32>,
    @location(2) v_gamma_scale: f32,
    @location(3) v_tex_a: vec2<f32>,
    @location(4) v_tex_b: vec2<f32>,
    @location(5) v_color: vec4<f32>,
    @location(6) v_blur: f32,
    @location(7) v_opacity: f32,
    @location(8) v_floorwidth: f32,
    @location(9) v_sdfgamma: f32,
    @location(10) v_mix: f32,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];

    let ANTIALIASING: f32 = 1.0 / drawable.device_pixel_ratio / 2.0;

    // Unpack a_pos_normal: position = floor(v * 0.5), normal = v - 2*pos
    let pos_normal_f = vec2<f32>(f32(vin.pos_normal.x), f32(vin.pos_normal.y));
    let pos = floor(pos_normal_f * 0.5);
    var normal = pos_normal_f - 2.0 * pos;
    normal.y = normal.y * 2.0 - 1.0;
    vout.v_normal = normal;

    // Unpack a_data: extrude = xy - 128, direction = mod(z, 4) - 1
    let a_extrude = vec2<f32>(f32(vin.data.x) - 128.0, f32(vin.data.y) - 128.0);
    let a_direction = f32(vin.data.z % 4u) - 1.0;

    // Compute linesofar from packed data (z upper bits + w * 64) * LINE_DISTANCE_SCALE
    let a_linesofar = (floor(f32(vin.data.z) * 0.25) + f32(vin.data.w) * 64.0) * LINE_DISTANCE_SCALE;

    // --- Resolve paint properties (uniform or data-driven) ---

    var color = props.color;
#ifdef HAS_DATA_DRIVEN_u_color
    color = decode_color(vin.color.xy);
#endif
#ifdef HAS_COMPOSITE_u_color
    color = unpack_mix_color(vin.color, drawable.color_t);
#endif

    var blur = props.blur;
#ifdef HAS_DATA_DRIVEN_u_blur
    blur = vin.blur.x;
#endif
#ifdef HAS_COMPOSITE_u_blur
    blur = unpack_mix_float(vin.blur, drawable.blur_t);
#endif

    var opacity = props.opacity;
#ifdef HAS_DATA_DRIVEN_u_opacity
    opacity = vin.opacity.x;
#endif
#ifdef HAS_COMPOSITE_u_opacity
    opacity = unpack_mix_float(vin.opacity, drawable.opacity_t);
#endif

    var gapwidth = props.gapwidth;
#ifdef HAS_DATA_DRIVEN_u_gapwidth
    gapwidth = vin.gapwidth.x;
#endif
#ifdef HAS_COMPOSITE_u_gapwidth
    gapwidth = unpack_mix_float(vin.gapwidth, drawable.gapwidth_t);
#endif
    gapwidth = gapwidth / 2.0;

    var offset = props.offset;
#ifdef HAS_DATA_DRIVEN_u_offset
    offset = vin.offset.x;
#endif
#ifdef HAS_COMPOSITE_u_offset
    offset = unpack_mix_float(vin.offset, drawable.offset_t);
#endif
    offset = -1.0 * offset;

    var width = props.width;
#ifdef HAS_DATA_DRIVEN_u_width
    width = vin.width.x;
#endif
#ifdef HAS_COMPOSITE_u_width
    width = unpack_mix_float(vin.width, drawable.width_t);
#endif

    var floorwidth = props.floorwidth;
#ifdef HAS_DATA_DRIVEN_u_floorwidth
    floorwidth = vin.floorwidth.x;
#endif
#ifdef HAS_COMPOSITE_u_floorwidth
    floorwidth = unpack_mix_float(vin.floorwidth, drawable.floorwidth_t);
#endif

    let halfwidth = width / 2.0;

    var inset: f32;
    if (gapwidth > 0.0) {
        inset = gapwidth + ANTIALIASING;
    } else {
        inset = gapwidth;
    }

    var outset: f32;
    if (halfwidth == 0.0) {
        if (gapwidth > 0.0) {
            outset = gapwidth + halfwidth * 2.0;
        } else {
            outset = gapwidth + halfwidth;
        }
    } else {
        if (gapwidth > 0.0) {
            outset = gapwidth + halfwidth * 2.0 + ANTIALIASING;
        } else {
            outset = gapwidth + halfwidth + ANTIALIASING;
        }
    }

    // Scale extrusion to line width
    let dist = outset * a_extrude * LINE_SCALE;

    // Offset for offset lines
    let u = 0.5 * a_direction;
    let t = 1.0 - abs(u);
    // mat2 multiply: (t, -u; u, t) * (a_extrude * scale * normal.y)
    let base_offset = offset * a_extrude * LINE_SCALE * normal.y;
    let offset2 = vec2<f32>(
        base_offset.x * t - base_offset.y * u,
        base_offset.x * u + base_offset.y * t
    );

    // Project base position to clip space
    let projected_no_extrude = drawable.matrix * vec4<f32>(pos + offset2 / drawable.ratio, 0.0, 1.0);

    // Apply extrusion in clip space (dist is in CSS pixels)
    let cssWidth = paintParams.world_size.x / paintParams.pixel_ratio;
    let cssHeight = paintParams.world_size.y / paintParams.pixel_ratio;
    let clipScale = vec2<f32>(2.0 / cssWidth, -2.0 / cssHeight);
    var position = vec4<f32>(
        projected_no_extrude.x + dist.x * clipScale.x * projected_no_extrude.w,
        projected_no_extrude.y + dist.y * clipScale.y * projected_no_extrude.w,
        projected_no_extrude.z,
        projected_no_extrude.w
    );
    // Remap z from WebGL NDC [-1,1] to WebGPU NDC [0,1]
    position.z = (position.z + position.w) * 0.5;
    vout.position = position;

    // Gamma scale: perspective correction for antialiasing
    let extrude_length_without_perspective = length(dist);
    let projected_with_extrude_xy = vec2<f32>(
        projected_no_extrude.x + dist.x * clipScale.x * projected_no_extrude.w,
        projected_no_extrude.y + dist.y * clipScale.y * projected_no_extrude.w
    );
    let extrude_length_with_perspective = length(
        (projected_with_extrude_xy - projected_no_extrude.xy) / projected_no_extrude.w * drawable.units_to_pixels
    );
    vout.v_gamma_scale = extrude_length_without_perspective / max(extrude_length_with_perspective, 1e-6);

    // Compute SDF texture coordinates from linesofar and pattern scale
    let safe_floorwidth = max(floorwidth, 1e-6);
    vout.v_tex_a = vec2<f32>(
        a_linesofar * drawable.patternscale_a.x / safe_floorwidth,
        normal.y * drawable.patternscale_a.y + drawable.tex_y_a
    );
    vout.v_tex_b = vec2<f32>(
        a_linesofar * drawable.patternscale_b.x / safe_floorwidth,
        normal.y * drawable.patternscale_b.y + drawable.tex_y_b
    );

    vout.v_width2 = vec2<f32>(outset, inset);
    vout.v_color = color;
    vout.v_blur = blur;
    vout.v_opacity = opacity;
    vout.v_floorwidth = floorwidth;
    vout.v_sdfgamma = drawable.sdfgamma;
    vout.v_mix = drawable.mix_value;

    return vout;
}

struct FragmentInput {
    @location(0) v_normal: vec2<f32>,
    @location(1) v_width2: vec2<f32>,
    @location(2) v_gamma_scale: f32,
    @location(3) v_tex_a: vec2<f32>,
    @location(4) v_tex_b: vec2<f32>,
    @location(5) v_color: vec4<f32>,
    @location(6) v_blur: f32,
    @location(7) v_opacity: f32,
    @location(8) v_floorwidth: f32,
    @location(9) v_sdfgamma: f32,
    @location(10) v_mix: f32,
};

@group(1) @binding(0) var sdf_sampler: sampler;
@group(1) @binding(1) var sdf_texture: texture_2d<f32>;

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    // Distance of pixel from line center in pixels
    let dist = length(fin.v_normal) * fin.v_width2.x;

    // Antialiasing fade
    let blur2 = (fin.v_blur + 1.0 / paintParams.pixel_ratio) * fin.v_gamma_scale;
    let alpha = clamp(min(dist - (fin.v_width2.y - blur2), fin.v_width2.x - dist) / blur2, 0.0, 1.0);

    // SDF dash texture sampling (r8unorm format — SDF value in .r channel)
    let sdfdist_a = textureSample(sdf_texture, sdf_sampler, fin.v_tex_a).r;
    let sdfdist_b = textureSample(sdf_texture, sdf_sampler, fin.v_tex_b).r;
    let sdfdist = mix(sdfdist_a, sdfdist_b, fin.v_mix);
    let safe_floorwidth = max(fin.v_floorwidth, 1e-6);
    let sdf_alpha = smoothstep(0.5 - fin.v_sdfgamma / safe_floorwidth,
                               0.5 + fin.v_sdfgamma / safe_floorwidth, sdfdist);

    return fin.v_color * (alpha * fin.v_opacity * sdf_alpha);
}
