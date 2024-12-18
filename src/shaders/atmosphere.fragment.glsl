in vec3 view_direction;

uniform vec3 u_sun_pos;
uniform vec3 u_globe_position;
uniform float u_globe_radius;
uniform float u_atmosphere_blend;

/*
 * Shader use from https://github.com/wwwtyro/glsl-atmosphere
 * Made some change to adapt to MapLibre Globe geometry
 */

const float PI = 3.141592653589793;
const int iSteps = 5;
const int jSteps = 3;

/* radius of the planet */
const float EARTH_RADIUS = 6371e3;
/* radius of the atmosphere */
const float ATMOS_RADIUS = 6471e3;

vec2 rsi(vec3 r0, vec3 rd, float sr) {
    // ray-sphere intersection that assumes
    // the sphere is centered at the origin.
    // No intersection when result.x > result.y
    float a = dot(rd, rd);
    float b = 2.0 * dot(rd, r0);
    float c = dot(r0, r0) - (sr * sr);
    float d = (b*b) - 4.0*a*c;
    if (d < 0.0) return vec2(1e5,-1e5);
    return vec2(
        (-b - sqrt(d))/(2.0*a),
        (-b + sqrt(d))/(2.0*a)
    );
}


vec4 atmosphere(vec3 r, vec3 r0, vec3 pSun, float iSun, float rPlanet, float rAtmos, vec3 kRlh, float kMie, float shRlh, float shMie, float g) {
    // Normalize the sun and view directions.
    pSun = normalize(pSun);
    r = normalize(r);

    // Calculate the step size of the primary ray.
    vec2 p = rsi(r0, r, rAtmos);
    if (p.x > p.y) {
        return vec4(0.0, 0.0, 0.0, 1.0);
    }

    if (p.x < 0.0) {
        p.x = 0.0;
    }

    vec3 pos = r0 + r * p.x;

    vec2 p2 = rsi(r0, r, rPlanet);
    if (p2.x <= p2.y && p2.x > 0.0) {
        p.y = min(p.y, p2.x);
    }
    float iStepSize = (p.y - p.x) / float(iSteps);

    // Initialize the primary ray time.
    float iTime = p.x + iStepSize * 0.5;

    // Initialize accumulators for Rayleigh and Mie scattering.
    vec3 totalRlh = vec3(0,0,0);
    vec3 totalMie = vec3(0,0,0);

    // Initialize optical depth accumulators for the primary ray.
    float iOdRlh = 0.0;
    float iOdMie = 0.0;

    // Calculate the Rayleigh and Mie phases.
    float mu = dot(r, pSun);
    float mumu = mu * mu;
    float gg = g * g;
    float pRlh = 3.0 / (16.0 * PI) * (1.0 + mumu);
    float pMie = 3.0 / (8.0 * PI) * ((1.0 - gg) * (mumu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * g, 1.5) * (2.0 + gg));

    // Sample the primary ray.
    for (int i = 0; i < iSteps; i++) {

        // Calculate the primary ray sample position.
        vec3 iPos = r0 + r * iTime;

        // Calculate the height of the sample.
        float iHeight = length(iPos) - rPlanet;

        // Calculate the optical depth of the Rayleigh and Mie scattering for this step.
        float odStepRlh = exp(-iHeight / shRlh) * iStepSize;
        float odStepMie = exp(-iHeight / shMie) * iStepSize;

        // Accumulate optical depth.
        iOdRlh += odStepRlh;
        iOdMie += odStepMie;

        // Calculate the step size of the secondary ray.
        float jStepSize = rsi(iPos, pSun, rAtmos).y / float(jSteps);

        // Initialize the secondary ray time.
        float jTime = jStepSize * 0.5;

        // Initialize optical depth accumulators for the secondary ray.
        float jOdRlh = 0.0;
        float jOdMie = 0.0;

        // Sample the secondary ray.
        for (int j = 0; j < jSteps; j++) {

            // Calculate the secondary ray sample position.
            vec3 jPos = iPos + pSun * jTime;

            // Calculate the height of the sample.
            float jHeight = length(jPos) - rPlanet;

            // Accumulate the optical depth.
            jOdRlh += exp(-jHeight / shRlh) * jStepSize;
            jOdMie += exp(-jHeight / shMie) * jStepSize;

            // Increment the secondary ray time.
            jTime += jStepSize;
        }

        // Calculate attenuation.
        vec3 attn = exp(-(kMie * (iOdMie + jOdMie) + kRlh * (iOdRlh + jOdRlh)));

        // Accumulate scattering.
        totalRlh += odStepRlh * attn;
        totalMie += odStepMie * attn;

        // Increment the primary ray time.
        iTime += iStepSize;
    }

    // Calculate opacity
    float opacity = exp(-(length(kRlh) * length(totalRlh) + kMie * length(totalMie))); // We need to approximate attenuation with a single "grayscale" value instead of a color.

    // Calculate the final color.
    vec3 color = iSun * (pRlh * kRlh * totalRlh + pMie * kMie * totalMie);

    return vec4(color, opacity);
}

void main() {
    // The globe is small compare to real Earth.
    // To still have a correct atmosphere rendering, we scale the whole world to the EARTH_RADIUS.
    // Change camera position accordingly.
    vec3 scale_camera_pos = -u_globe_position * EARTH_RADIUS / u_globe_radius;

    vec4 color = atmosphere(
        normalize(view_direction),      // ray direction
        scale_camera_pos,               // ray origin
        u_sun_pos,                      // position of the sun
        22.0,                           // intensity of the sun
        EARTH_RADIUS,                   // radius of the planet in meters
        ATMOS_RADIUS,                   // radius of the atmosphere in meters
        vec3(5.5e-6, 13.0e-6, 22.4e-6), // Rayleigh scattering coefficient
        21e-6,                          // Mie scattering coefficient
        8e3,                            // Rayleigh scale height
        1.2e3,                          // Mie scale height
        0.758                           // Mie preferred scattering direction
    );

    // Apply exposure.
    color.rgb = 1.0 - exp(-1.0 * color.rgb);
    // Apply gamma for correctness
    color = pow(color, vec4(1.0 / 2.2)); // Gamma-correct the alpha channel as well (blending itself will not be gamma correct, so doing this helps visuals a bit).
    fragColor = vec4(color.rgb, 1.0 - color.a) * u_atmosphere_blend;
}
