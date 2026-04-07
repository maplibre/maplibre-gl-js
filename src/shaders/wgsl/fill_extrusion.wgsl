struct FillExtrusionDrawableUBO {
    matrix: mat4x4<f32>,
    lightpos_and_intensity: vec4<f32>,
    lightcolor_and_something: vec4<f32>,
    vertical_gradient: f32,
    opacity: f32,
    base_t: f32,
    height_t: f32,
    color_t: f32,
    pad1: f32,
    pad2: f32,
    pad3: f32,
};

struct FillExtrusionPropsUBO {
    color: vec4<f32>,
    base: f32,
    height: f32,
    pad1: f32,
    pad2: f32,
};

struct GlobalIndexUBO {
    value: u32,
    pad0: vec3<u32>,
};

@group(0) @binding(1) var<uniform> globalIndex: GlobalIndexUBO;
@group(0) @binding(2) var<storage, read> drawableVector: array<FillExtrusionDrawableUBO>;
@group(0) @binding(4) var<uniform> props: FillExtrusionPropsUBO;

fn glMod(x: f32, y: f32) -> f32 {
    return x - y * floor(x / y);
}

fn unpack_mix_float(packedValue: vec2<f32>, t: f32) -> f32 {
    return mix(packedValue.x, packedValue.y, t);
}

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

// VertexInput is generated dynamically in JS

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) frag_color: vec4<f32>,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];

    // Unpack base
    var baseValue = props.base;
#ifdef HAS_DATA_DRIVEN_u_base
    baseValue = vin.base;
#endif
#ifdef HAS_COMPOSITE_u_base
    baseValue = unpack_mix_float(vin.base, drawable.base_t);
#endif
    baseValue = max(baseValue, 0.0);

    // Unpack height
    var heightValue = props.height;
#ifdef HAS_DATA_DRIVEN_u_height
    heightValue = vin.height;
#endif
#ifdef HAS_COMPOSITE_u_height
    heightValue = unpack_mix_float(vin.height, drawable.height_t);
#endif
    heightValue = max(heightValue, 0.0);

    // Normal from packed attribute
    let normal = vec3<f32>(f32(vin.normal_ed.x), f32(vin.normal_ed.y), f32(vin.normal_ed.z));
    let t = glMod(normal.x, 2.0);

    // Select base or height elevation depending on whether this is a top or side vertex
    let z = select(baseValue, heightValue, t != 0.0);

    let pos = vec2<f32>(f32(vin.pos.x), f32(vin.pos.y));
    vout.position = drawable.matrix * vec4<f32>(pos, z, 1.0);

    // Remap z from WebGL NDC [-1,1] to WebGPU NDC [0,1]
    vout.position.z = (vout.position.z + vout.position.w) * 0.5;

    // Unpack color
    var color = props.color;
#ifdef HAS_DATA_DRIVEN_u_color
    color = decode_color(vin.color);
#endif
#ifdef HAS_COMPOSITE_u_color
    color = unpack_mix_color(vin.color, drawable.color_t);
#endif

    // Add slight ambient lighting so no extrusions are totally black
    color = color + min(vec4<f32>(0.03, 0.03, 0.03, 1.0), vec4<f32>(1.0));

    // Relative luminance (how dark/bright is the surface color?)
    let luminance = dot(color.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));

    // Lighting computation
    let lightPos = drawable.lightpos_and_intensity.xyz;
    let lightIntensity = drawable.lightpos_and_intensity.w;
    let lightColor = drawable.lightcolor_and_something.xyz;
    let verticalGradient = drawable.vertical_gradient;

    // Calculate cos(theta), where theta is the angle between surface normal and diffuse light ray
    let unitNormal = normal / 16384.0;
    let directionalFraction = clamp(dot(unitNormal, lightPos), 0.0, 1.0);

    // Adjust directional so that the range of values for highlight/shading is narrower
    // with lower light intensity and with lighter/brighter surface colors
    let minDirectional = 1.0 - lightIntensity;
    let maxDirectional = max(1.0 - luminance + lightIntensity, 1.0);
    var directional = mix(minDirectional, maxDirectional, directionalFraction);

    // Add gradient along z axis of side surfaces
    if (normal.y != 0.0) {
        let gradientMin = mix(0.7, 0.98, 1.0 - lightIntensity);
        let factor = clamp((t + baseValue) * pow(heightValue / 150.0, 0.5), gradientMin, 1.0);
        directional *= (1.0 - verticalGradient) + verticalGradient * factor;
    }

    // Assign final color based on surface + ambient light color, diffuse light directional, and light color
    // with lower bounds adjusted to hue of light so that shading is tinted with the complementary color
    let minLight = mix(vec3<f32>(0.0), vec3<f32>(0.3), 1.0 - lightColor);
    let lit = clamp(color.rgb * directional * lightColor, minLight, vec3<f32>(1.0));

    var vcolor = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    vcolor = vec4<f32>(vcolor.rgb + lit, vcolor.a);

    vout.frag_color = vcolor * drawable.opacity;
    return vout;
}

struct FragmentInput {
    @location(0) frag_color: vec4<f32>,
};

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    return fin.frag_color;
}
