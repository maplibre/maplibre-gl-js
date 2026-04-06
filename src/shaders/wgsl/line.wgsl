// Line shader — basic solid-color lines (no patterns/SDF/gradients)

// floor(127 / 2) == 63.0 → scale = 1/63
const LINE_SCALE: f32 = 0.015873016;

struct LineDrawableUBO {
    matrix: mat4x4<f32>,          // 0-63
    ratio: f32,                    // 64
    device_pixel_ratio: f32,       // 68
    units_to_pixels: vec2<f32>,    // 72-79
    // Composite expression interpolation factors
    color_t: f32,                  // 80
    opacity_t: f32,                // 84
    blur_t: f32,                   // 88
    width_t: f32,                  // 92
    gapwidth_t: f32,               // 96
    offset_t: f32,                 // 100
    pad0: f32,                     // 104
    pad1: f32,                     // 108
    pad2: vec4<f32>,               // 112 — padding to 128
};

struct LinePropsUBO {
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
@group(0) @binding(2) var<storage, read> drawableVector: array<LineDrawableUBO>;
@group(0) @binding(4) var<uniform> props: LinePropsUBO;

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
    @location(0) v_normal: vec2<f32>,
    @location(1) v_width2: vec2<f32>,
    @location(2) v_gamma_scale: f32,
    @location(3) v_color: vec4<f32>,
    @location(4) v_opacity: f32,
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

    // Resolve data-driven properties
    var color = props.color;
#ifdef HAS_DATA_DRIVEN_u_color
    color = decode_color(vin.color);
#endif
#ifdef HAS_COMPOSITE_u_color
    color = unpack_mix_color(vin.color, drawable.color_t);
#endif

    var width = props.width;
#ifdef HAS_DATA_DRIVEN_u_width
    width = vin.width;
#endif
#ifdef HAS_COMPOSITE_u_width
    width = unpack_mix_float(vin.width, drawable.width_t);
#endif

    var opacity = props.opacity;
#ifdef HAS_DATA_DRIVEN_u_opacity
    opacity = vin.opacity;
#endif
#ifdef HAS_COMPOSITE_u_opacity
    opacity = unpack_mix_float(vin.opacity, drawable.opacity_t);
#endif

    var blur = props.blur;
#ifdef HAS_DATA_DRIVEN_u_blur
    blur = vin.blur;
#endif
#ifdef HAS_COMPOSITE_u_blur
    blur = unpack_mix_float(vin.blur, drawable.blur_t);
#endif

    var gapwidth = props.gapwidth / 2.0;
#ifdef HAS_DATA_DRIVEN_u_gapwidth
    gapwidth = vin.gapwidth / 2.0;
#endif
#ifdef HAS_COMPOSITE_u_gapwidth
    gapwidth = unpack_mix_float(vin.gapwidth, drawable.gapwidth_t) / 2.0;
#endif

    var offset = -1.0 * props.offset;
#ifdef HAS_DATA_DRIVEN_u_offset
    offset = -1.0 * vin.offset;
#endif
#ifdef HAS_COMPOSITE_u_offset
    offset = -1.0 * unpack_mix_float(vin.offset, drawable.offset_t);
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

    // Direction for round/bevel joins
    let a_direction = f32(vin.data.z % 4u) - 1.0;
    let u = 0.5 * a_direction;
    let t = 1.0 - abs(u);

    // Offset perpendicular to line direction
    let base_offset = offset * a_extrude * LINE_SCALE * normal.y;
    let offset2 = vec2<f32>(
        base_offset.x * t - base_offset.y * u,
        base_offset.x * u + base_offset.y * t
    );

    // Clip-space line extrusion
    let projected_no_extrude = drawable.matrix * vec4<f32>(pos + offset2 / drawable.ratio, 0.0, 1.0);
    let cssWidth = paintParams.world_size.x / paintParams.pixel_ratio;
    let cssHeight = paintParams.world_size.y / paintParams.pixel_ratio;
    let clipScale = vec2<f32>(2.0 / cssWidth, -2.0 / cssHeight);
    var position = vec4<f32>(
        projected_no_extrude.x + dist.x * clipScale.x * projected_no_extrude.w,
        projected_no_extrude.y + dist.y * clipScale.y * projected_no_extrude.w,
        projected_no_extrude.z,
        projected_no_extrude.w
    );
    position.z = (position.z + position.w) * 0.5;
    vout.position = position;

    // Gamma scale for antialiasing
    let extrude_length_without_perspective = length(dist);
    let projected_with_extrude_xy = vec2<f32>(
        projected_no_extrude.x + dist.x * clipScale.x * projected_no_extrude.w,
        projected_no_extrude.y + dist.y * clipScale.y * projected_no_extrude.w
    );
    let extrude_length_with_perspective = length(
        (projected_with_extrude_xy - projected_no_extrude.xy) / projected_no_extrude.w * drawable.units_to_pixels
    );
    vout.v_gamma_scale = extrude_length_without_perspective / max(extrude_length_with_perspective, 1e-6);

    vout.v_width2 = vec2<f32>(outset, inset);
    vout.v_color = color;
    vout.v_opacity = opacity;

    return vout;
}

struct FragmentInput {
    @location(0) v_normal: vec2<f32>,
    @location(1) v_width2: vec2<f32>,
    @location(2) v_gamma_scale: f32,
    @location(3) v_color: vec4<f32>,
    @location(4) v_opacity: f32,
};

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let color = fin.v_color;
    let blur = props.blur;
    let opacity = fin.v_opacity;

    // Distance of pixel from line center in pixels
    let dist = length(fin.v_normal) * fin.v_width2.x;

    // Antialiasing fade
    let blur2 = (blur + 1.0 / paintParams.pixel_ratio) * fin.v_gamma_scale;
    let alpha = clamp(min(dist - (fin.v_width2.y - blur2), fin.v_width2.x - dist) / blur2, 0.0, 1.0);

    return color * (alpha * opacity);
}
