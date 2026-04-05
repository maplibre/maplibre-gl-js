// Line pattern shader — renders lines with image pattern texture
// Reference: maplibre-native LinePatternShader (webgpu/line.hpp)

const LINE_SCALE: f32 = 0.015873016;
const LINE_DISTANCE_SCALE: f32 = 2.0;

struct LinePatternDrawableUBO {
    matrix: mat4x4<f32>,                // offset 0,  size 64
    ratio: f32,                         // offset 64
    device_pixel_ratio: f32,            // offset 68
    units_to_pixels: vec2<f32>,         // offset 72
    pixel_coord_upper: vec2<f32>,       // offset 80
    pixel_coord_lower: vec2<f32>,       // offset 88
    tile_ratio: f32,                    // offset 96
    pad0: f32,                          // offset 100
    pad1: f32,                          // offset 104
    pad2: f32,                          // offset 108
    pad3: vec4<f32>,                    // offset 112
};

struct LinePatternPropsUBO {
    color: vec4<f32>,                   // offset 0 (unused, but keeps layout)
    pattern_from: vec4<f32>,            // offset 16
    pattern_to: vec4<f32>,              // offset 32
    display_sizes: vec4<f32>,           // offset 48 — sizeFromX, sizeFromY, sizeToX, sizeToY
    scales_fade_opacity: vec4<f32>,     // offset 64 — fromScale, toScale, fade, opacity
    texsize_width: vec4<f32>,           // offset 80 — texsizeX, texsizeY, width, blur
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
@group(0) @binding(2) var<storage, read> drawableVector: array<LinePatternDrawableUBO>;
@group(0) @binding(4) var<uniform> props: LinePatternPropsUBO;

// VertexInput is generated dynamically in JS

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) v_normal: vec2<f32>,
    @location(1) v_width2: vec2<f32>,
    @location(2) v_gamma_scale: f32,
    @location(3) v_linesofar: f32,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];

    let ANTIALIASING: f32 = 1.0 / drawable.device_pixel_ratio / 2.0;

    // Unpack a_pos_normal
    let pos_normal_f = vec2<f32>(f32(vin.pos_normal.x), f32(vin.pos_normal.y));
    let pos = floor(pos_normal_f * 0.5);
    var normal = pos_normal_f - 2.0 * pos;
    normal.y = normal.y * 2.0 - 1.0;
    vout.v_normal = normal;

    // Unpack a_data: extrude (xy), direction (z%4 - 1), linesofar
    let a_extrude = vec2<f32>(f32(vin.data.x) - 128.0, f32(vin.data.y) - 128.0);
    let a_direction = f32(vin.data.z % 4u) - 1.0;
    let a_linesofar = (floor(f32(vin.data.z) * 0.25) + f32(vin.data.w) * 64.0) * LINE_DISTANCE_SCALE;

    // Line properties (width/blur/etc from props - keeping simple for now)
    let width = props.texsize_width.z;
    let blur = props.texsize_width.w;
    let gapwidth = 0.0;  // TODO: support gapwidth
    let halfwidth = width / 2.0;
    let offset = 0.0;

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
    let u = 0.5 * a_direction;
    let t = 1.0 - abs(u);
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
    vout.v_linesofar = a_linesofar;

    return vout;
}

struct FragmentInput {
    @location(0) v_normal: vec2<f32>,
    @location(1) v_width2: vec2<f32>,
    @location(2) v_gamma_scale: f32,
    @location(3) v_linesofar: f32,
};

@group(1) @binding(0) var pattern_sampler: sampler;
@group(1) @binding(1) var pattern_texture: texture_2d<f32>;

fn glMod(x: f32, y: f32) -> f32 {
    return x - y * floor(x / y);
}

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let pattern_tl_a = props.pattern_from.xy;
    let pattern_br_a = props.pattern_from.zw;
    let pattern_tl_b = props.pattern_to.xy;
    let pattern_br_b = props.pattern_to.zw;
    let display_size_a = vec2<f32>(props.display_sizes.x, props.display_sizes.y);
    let display_size_b = vec2<f32>(props.display_sizes.z, props.display_sizes.w);
    let fromScale = props.scales_fade_opacity.x;
    let toScale = props.scales_fade_opacity.y;
    let fade = props.scales_fade_opacity.z;
    let opacity = props.scales_fade_opacity.w;
    let texsize = vec2<f32>(props.texsize_width.x, props.texsize_width.y);
    let v_width = props.texsize_width.z;
    let blur = props.texsize_width.w;

    // Distance of pixel from line center in pixels
    let dist = length(fin.v_normal) * fin.v_width2.x;

    // Antialiasing fade
    let blur2 = (blur + 1.0 / paintParams.pixel_ratio) * fin.v_gamma_scale;
    let alpha = clamp(min(dist - (fin.v_width2.y - blur2), fin.v_width2.x - dist) / blur2, 0.0, 1.0);

    // Pattern tiling along line direction
    let safeWidth = max(v_width, 1e-6);
    let aspect_a = display_size_a.y / safeWidth;
    let aspect_b = display_size_b.y / safeWidth;

    let tileZoomRatio = 1.0;  // simplified — native uses tile_ratio from drawable
    let pattern_size_a = vec2<f32>(display_size_a.x * fromScale / tileZoomRatio, display_size_a.y);
    let pattern_size_b = vec2<f32>(display_size_b.x * toScale / tileZoomRatio, display_size_b.y);

    let x_a = glMod(fin.v_linesofar / max(pattern_size_a.x, 1e-6) * aspect_a, 1.0);
    let x_b = glMod(fin.v_linesofar / max(pattern_size_b.x, 1e-6) * aspect_b, 1.0);

    let y = 0.5 * fin.v_normal.y + 0.5;

    let texel_size = 1.0 / texsize;
    let pos_a = mix(pattern_tl_a * texel_size - texel_size, pattern_br_a * texel_size + texel_size, vec2<f32>(x_a, y));
    let pos_b = mix(pattern_tl_b * texel_size - texel_size, pattern_br_b * texel_size + texel_size, vec2<f32>(x_b, y));

    let color_a = textureSample(pattern_texture, pattern_sampler, pos_a);
    let color_b = textureSample(pattern_texture, pattern_sampler, pos_b);
    let color = mix(color_a, color_b, fade);

    return color * alpha * opacity;
}
