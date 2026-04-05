// Terrain shader — renders 3D terrain mesh with elevation and tile texture

struct TerrainDrawableUBO {
    matrix: mat4x4<f32>,           // offset 0,  size 64  — main projection matrix
    fog_matrix: mat4x4<f32>,       // offset 64, size 64  — fog depth calculation
    terrain_matrix: mat4x4<f32>,   // offset 128, size 64 — DEM texture coord transform
    ele_delta: f32,                // offset 192
    terrain_dim: f32,              // offset 196
    terrain_exaggeration: f32,     // offset 200
    is_globe_mode: u32,            // offset 204
    fog_ground_blend: f32,         // offset 208
    fog_ground_blend_opacity: f32, // offset 212
    horizon_fog_blend: f32,        // offset 216
    pad0: f32,                     // offset 220
    terrain_unpack: vec4<f32>,     // offset 224
    fog_color: vec4<f32>,          // offset 240
    horizon_color: vec4<f32>,      // offset 256
    pad1: vec4<f32>,               // offset 272
};

struct GlobalIndexUBO {
    value: u32,
    pad0: vec3<u32>,
};

@group(0) @binding(1) var<uniform> globalIndex: GlobalIndexUBO;
@group(0) @binding(2) var<storage, read> drawableVector: array<TerrainDrawableUBO>;

// Texture bindings at @group(1)
// binding 0: surface sampler
// binding 1: surface texture (rendered tile content)
// binding 2: terrain sampler
// binding 3: terrain DEM texture
@group(1) @binding(0) var surface_sampler: sampler;
@group(1) @binding(1) var surface_texture: texture_2d<f32>;
@group(1) @binding(2) var terrain_sampler: sampler;
@group(1) @binding(3) var terrain_texture: texture_2d<f32>;

fn ele(pos: vec2<f32>, drawable: TerrainDrawableUBO) -> f32 {
    let rgb = textureSampleLevel(terrain_texture, terrain_sampler, pos, 0.0) * 255.0;
    return rgb.r * drawable.terrain_unpack.r
         + rgb.g * drawable.terrain_unpack.g
         + rgb.b * drawable.terrain_unpack.b
         - drawable.terrain_unpack.a;
}

fn get_elevation(pos: vec2<f32>, drawable: TerrainDrawableUBO) -> f32 {
    let terrain_dim = drawable.terrain_dim;
    let coord = (drawable.terrain_matrix * vec4<f32>(pos, 0.0, 1.0)).xy * terrain_dim + 1.0;
    let f = fract(coord);
    let c = (floor(coord) + 0.5) / (terrain_dim + 2.0);
    let d = 1.0 / (terrain_dim + 2.0);
    let tl = ele(c, drawable);
    let tr = ele(c + vec2<f32>(d, 0.0), drawable);
    let bl = ele(c + vec2<f32>(0.0, d), drawable);
    let br = ele(c + vec2<f32>(d, d), drawable);
    let elevation = mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
    return elevation * drawable.terrain_exaggeration;
}

// VertexInput is generated dynamically in JS
// Expected: @location(0) pos3d: vec3<i16>

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) v_texture_pos: vec2<f32>,
    @location(1) v_fog_depth: f32,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];

    let a_pos = vec2<f32>(f32(vin.pos3d.x), f32(vin.pos3d.y));
    let a_pos_z = f32(vin.pos3d.z);

    let elevation = get_elevation(a_pos, drawable);
    let ele_delta = select(0.0, drawable.ele_delta, a_pos_z == 1.0);
    vout.v_texture_pos = a_pos / 8192.0;

    let world_pos = vec4<f32>(a_pos.x, a_pos.y, elevation - ele_delta, 1.0);
    vout.position = drawable.matrix * world_pos;
    vout.position.z = (vout.position.z + vout.position.w) * 0.5;

    let fog_pos = drawable.fog_matrix * vec4<f32>(a_pos, elevation, 1.0);
    vout.v_fog_depth = fog_pos.z / fog_pos.w * 0.5 + 0.5;

    return vout;
}

struct FragmentInput {
    @location(0) v_texture_pos: vec2<f32>,
    @location(1) v_fog_depth: f32,
};

const GAMMA: f32 = 2.2;

fn gammaToLinear(color: vec4<f32>) -> vec4<f32> {
    return pow(color, vec4<f32>(GAMMA));
}

fn linearToGamma(color: vec4<f32>) -> vec4<f32> {
    return pow(color, vec4<f32>(1.0 / GAMMA));
}

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let drawable = drawableVector[globalIndex.value];
    let surface_uv = vec2<f32>(fin.v_texture_pos.x, 1.0 - fin.v_texture_pos.y);
    let surface_color = textureSample(surface_texture, surface_sampler, surface_uv);

    let is_globe = drawable.is_globe_mode != 0u;
    if (!is_globe && fin.v_fog_depth > drawable.fog_ground_blend) {
        let surface_linear = gammaToLinear(surface_color);
        let blend_color = smoothstep(0.0, 1.0, max((fin.v_fog_depth - drawable.horizon_fog_blend) / (1.0 - drawable.horizon_fog_blend), 0.0));
        let fog_horizon_linear = mix(gammaToLinear(drawable.fog_color), gammaToLinear(drawable.horizon_color), blend_color);
        let factor_fog = max(fin.v_fog_depth - drawable.fog_ground_blend, 0.0) / (1.0 - drawable.fog_ground_blend);
        return linearToGamma(mix(surface_linear, fog_horizon_linear, pow(factor_fog, 2.0) * drawable.fog_ground_blend_opacity));
    }
    return surface_color;
}
