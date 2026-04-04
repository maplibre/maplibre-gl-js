// Hillshade Prepare shader — Pass 1: Compute slopes from DEM data
// Samples a 3x3 neighborhood of elevation values and computes x/y slope derivatives.

struct HillshadePrepareUBO {
    matrix: mat4x4<f32>,
    dimension: vec2<f32>,
    zoom: f32,
    maxzoom: f32,
    unpack: vec4<f32>,
};

struct GlobalIndexUBO {
    value: u32,
    pad0: vec3<u32>,
};

@group(0) @binding(1) var<uniform> globalIndex: GlobalIndexUBO;
@group(0) @binding(2) var<storage, read> drawableVector: array<HillshadePrepareUBO>;

// VertexInput is generated dynamically in JS

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) v_pos: vec2<f32>,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let ubo = drawableVector[globalIndex.value];

    let pos = vec2<f32>(f32(vin.pos.x), f32(vin.pos.y));
    vout.position = ubo.matrix * vec4<f32>(pos, 0.0, 1.0);
    vout.position.z = (vout.position.z + vout.position.w) * 0.5;

    let texcoord = vec2<f32>(f32(vin.texture_pos.x), f32(vin.texture_pos.y));
    vout.v_pos = texcoord / 8192.0;

    return vout;
}

struct FragmentInput {
    @location(0) v_pos: vec2<f32>,
};

@group(1) @binding(0) var dem_sampler: sampler;
@group(1) @binding(1) var dem_texture: texture_2d<f32>;

fn getElevation(ubo: HillshadePrepareUBO, coord: vec2<f32>) -> f32 {
    var pixel = textureSample(dem_texture, dem_sampler, coord);
    pixel.a = 1.0; // Some DEM sources don't properly encode alpha
    return dot(pixel, ubo.unpack) / 4.0;
}

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let ubo = drawableVector[globalIndex.value];

    let epsilon = 1.0 / ubo.dimension.x;
    let coord = fin.v_pos;

    // Compute the exaggeration factor based on zoom
    var exaggeration: f32;
    let zoom = ubo.zoom;
    if (zoom < 2.0) {
        exaggeration = 0.4;
    } else if (zoom < 4.5) {
        exaggeration = 0.35;
    } else {
        exaggeration = 0.3;
    }

    // Sample 3x3 neighborhood for Sobel-like derivatives
    let a = getElevation(ubo, coord + vec2<f32>(-epsilon, -epsilon));
    let b = getElevation(ubo, coord + vec2<f32>(0.0, -epsilon));
    let c = getElevation(ubo, coord + vec2<f32>(epsilon, -epsilon));
    let d = getElevation(ubo, coord + vec2<f32>(-epsilon, 0.0));
    let e = getElevation(ubo, coord);
    let f = getElevation(ubo, coord + vec2<f32>(epsilon, 0.0));
    let g = getElevation(ubo, coord + vec2<f32>(-epsilon, epsilon));
    let h = getElevation(ubo, coord + vec2<f32>(0.0, epsilon));
    let i = getElevation(ubo, coord + vec2<f32>(epsilon, epsilon));

    // Sobel filters for x and y slope
    let dzdx = ((c + 2.0 * f + i) - (a + 2.0 * d + g)) / 8.0 * exaggeration;
    let dzdy = ((g + 2.0 * h + i) - (a + 2.0 * b + c)) / 8.0 * exaggeration;

    // Encode slopes in r,g channels (offset by 0.5, scale by 0.5)
    return vec4<f32>(
        dzdx * 0.5 + 0.5,
        dzdy * 0.5 + 0.5,
        1.0,
        1.0
    );
}
