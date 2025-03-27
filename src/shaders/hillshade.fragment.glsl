uniform sampler2D u_image;
in vec2 v_pos;

uniform vec2 u_latrange;
uniform vec2 u_light;
uniform vec4 u_shadow;
uniform vec4 u_highlight;
uniform vec4 u_accent;
uniform int u_method;

#define PI 3.141592653589793

#define STANDARD 0
#define COMBINED 1
#define IGOR 2
#define MULTIDIRECTIONAL 3

float get_aspect(vec2 deriv)
{
    return deriv.x != 0.0 ? atan(deriv.y, -deriv.x) : PI / 2.0 * (deriv.y > 0.0 ? 1.0 : -1.0);
}

void igor_hillshade(vec2 deriv)
{
    float aspect = get_aspect(deriv);
    float azimuth = u_light.y + PI;
    float slope_stength = atan(length(deriv)) * 2.0/PI;
    float aspect_strength = 1.0 - abs(mod((aspect + azimuth) / PI + 0.5, 2.0) - 1.0);
    float shadow_strength = slope_stength * aspect_strength;
    float highlight_strength = slope_stength * (1.0-aspect_strength);
    fragColor = u_shadow * shadow_strength + u_highlight * highlight_strength;
}

void standard_hillshade(vec2 deriv)
{
    // We add PI to make this property match the global light object, which adds PI/2 to the light's azimuthal
    // position property to account for 0deg corresponding to north/the top of the viewport in the style spec
    // and the original shader was written to accept (-illuminationDirection - 90) as the azimuthal.
    float azimuth = u_light.y + PI;

    // We also multiply the slope by an arbitrary z-factor of 1.25
    float slope = atan(1.25 * length(deriv));
    float aspect = get_aspect(deriv);

    float intensity = u_light.x;

    // We scale the slope exponentially based on intensity, using a calculation similar to
    // the exponential interpolation function in the style spec:
    // src/style-spec/expression/definitions/interpolate.js#L217-L228
    // so that higher intensity values create more opaque hillshading.
    float base = 1.875 - intensity * 1.75;
    float maxValue = 0.5 * PI;
    float scaledSlope = intensity != 0.5 ? ((pow(base, slope) - 1.0) / (pow(base, maxValue) - 1.0)) * maxValue : slope;

    // The accent color is calculated with the cosine of the slope while the shade color is calculated with the sine
    // so that the accent color's rate of change eases in while the shade color's eases out.
    float accent = cos(scaledSlope);
    // We multiply both the accent and shade color by a clamped intensity value
    // so that intensities >= 0.5 do not additionally affect the color values
    // while intensity values < 0.5 make the overall color more transparent.
    vec4 accent_color = (1.0 - accent) * u_accent * clamp(intensity * 2.0, 0.0, 1.0);
    float shade = abs(mod((aspect + azimuth) / PI + 0.5, 2.0) - 1.0);
    vec4 shade_color = mix(u_shadow, u_highlight, shade) * sin(scaledSlope) * clamp(intensity * 2.0, 0.0, 1.0);
    fragColor = accent_color * (1.0 - shade_color.a) + shade_color;
}

void basic_hillshade(vec2 deriv)
{
    float azimuth = u_light.y + PI;
    float alt = 25.0*PI/180.0;
    float cos_az = cos(azimuth);
    float sin_az = sin(azimuth);
    float cos_alt = cos(alt);
    float sin_alt = sin(alt);

    float cang = (sin_alt - (deriv.y*cos_az*cos_alt - deriv.x*sin_az*cos_alt)) / sqrt(1.0 + dot(deriv, deriv));

    float shade = clamp(cang, 0.0, 1.0);
    fragColor = mix(u_shadow, u_highlight, shade)*abs(2.0*shade - 1.0);
}

void combined_hillshade(vec2 deriv)
{
    float azimuth = u_light.y + PI;
    float alt = 25.0*PI/180.0;
    float cos_az = cos(azimuth);
    float sin_az = sin(azimuth);
    float cos_alt = cos(alt);
    float sin_alt = sin(alt);

    float cang = (sin_alt - (deriv.y*cos_az*cos_alt - deriv.x*sin_az*cos_alt)) / sqrt(1.0 + dot(deriv, deriv));

    cang = mix(0.5, cang, atan(length(deriv)) * 2.0/PI);

    float shade = clamp(cang, 0.0, 1.0);
    fragColor = mix(u_shadow, u_highlight, shade)*abs(2.0*shade - 1.0);
}

void main() {
    vec4 pixel = texture(u_image, v_pos);

    // We divide the slope by a scale factor based on the cosin of the pixel's approximate latitude
    // to account for mercator projection distortion. see #4807 for details
    float scaleFactor = cos(radians((u_latrange[0] - u_latrange[1]) * (1.0 - v_pos.y) + u_latrange[1]));

    vec2 deriv = ((pixel.rg * 2.0) - 1.0)/scaleFactor;

    if(u_method == STANDARD)
    {
        standard_hillshade(deriv);
    }
    else if(u_method == COMBINED)
    {
        combined_hillshade(deriv);
    }
    else if(u_method == IGOR)
    {
        igor_hillshade(deriv);
    }
    else if(u_method == MULTIDIRECTIONAL)
    {
        basic_hillshade(deriv);
    }
    else
    {
        standard_hillshade(deriv);
    }

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
