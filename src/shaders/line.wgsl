// Line shader — basic solid-color lines (no patterns/SDF/gradients)
// Ported from line.vertex.glsl + line.fragment.glsl

// floor(127 / 2) == 63.0 → scale = 1/63
const LINE_SCALE: f32 = 0.015873016;

struct LineDrawableUBO {
    matrix: mat4x4<f32>,          // 64 bytes
    ratio: f32,                    // 1/pixelsToTileUnits
    device_pixel_ratio: f32,
    units_to_pixels: vec2<f32>,    // transform.pixelsToGLUnits
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

// VertexInput is generated dynamically in JS
// Expected attributes:
//   @location(0) pos_normal: vec2<i32>   — a_pos_normal (Int16 x2)
//   @location(1) data: vec4<u32>         — a_data (Uint8 x4)

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) v_normal: vec2<f32>,
    @location(1) v_width2: vec2<f32>,
    @location(2) v_gamma_scale: f32,
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

    // Uniform-path line properties (no data-driven)
    let width = props.width;
    let blur = props.blur;
    let opacity = props.opacity;
    var gapwidth = props.gapwidth / 2.0;
    let halfwidth = width / 2.0;
    var offset = -1.0 * props.offset;

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
    let a_direction = f32(vin.data.z % 4u) - 1.0;
    let u = 0.5 * a_direction;
    let t = 1.0 - abs(u);
    // mat2 multiply: (t, -u; u, t) * (a_extrude * scale * normal.y)
    let base_offset = offset * a_extrude * LINE_SCALE * normal.y;
    let offset2 = vec2<f32>(
        base_offset.x * t - base_offset.y * u,
        base_offset.x * u + base_offset.y * t
    );

    // Project base position (without extrusion) to clip space
    let projected_no_extrude = drawable.matrix * vec4<f32>(pos + offset2 / drawable.ratio, 0.0, 1.0);

    // Apply extrusion in clip space (dist is in CSS pixels)
    // Convert pixel offset to clip space: 2/viewport_css_width, scaled by w for perspective
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

    vout.v_width2 = vec2<f32>(outset, inset);

    return vout;
}

struct FragmentInput {
    @location(0) v_normal: vec2<f32>,
    @location(1) v_width2: vec2<f32>,
    @location(2) v_gamma_scale: f32,
};

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let color = props.color;
    let blur = props.blur;
    let opacity = props.opacity;

    // Distance of pixel from line center in pixels
    let dist = length(fin.v_normal) * fin.v_width2.x;

    // Antialiasing fade
    let blur2 = (blur + 1.0 / paintParams.pixel_ratio) * fin.v_gamma_scale;
    let alpha = clamp(min(dist - (fin.v_width2.y - blur2), fin.v_width2.x - dist) / blur2, 0.0, 1.0);

    return color * (alpha * opacity);
}
