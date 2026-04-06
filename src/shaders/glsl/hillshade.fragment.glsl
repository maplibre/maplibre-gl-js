uniform sampler2D u_image;
in vec2 v_pos;

uniform vec2 u_latrange;
uniform float u_exaggeration;
uniform vec4 u_accent;
uniform int u_method;
uniform float u_altitudes[NUM_ILLUMINATION_SOURCES];
uniform float u_azimuths[NUM_ILLUMINATION_SOURCES];
uniform vec4 u_shadows[NUM_ILLUMINATION_SOURCES];
uniform vec4 u_highlights[NUM_ILLUMINATION_SOURCES];

#define PI 3.141592653589793

#define STANDARD 0
#define COMBINED 1
#define IGOR 2
#define MULTIDIRECTIONAL 3
#define BASIC 4

float get_aspect(vec2 deriv)
{
    return deriv.x != 0.0 ? atan(deriv.y, -deriv.x) : PI / 2.0 * (deriv.y > 0.0 ? 1.0 : -1.0);
}

// Based on GDALHillshadeIgorAlg() (https://github.com/OSGeo/gdal/blob/ad4280be5aee202eea412c075e4591878aaeb018/apps/gdaldem_lib.cpp#L849).
// GDAL's version only calculates shading.
// This version also adds highlighting. To match GDAL's output, make hillshade-highlight-color transparent.
void igor_hillshade(vec2 deriv)
{
    deriv = deriv * u_exaggeration * 2.0;
    float aspect = get_aspect(deriv);
    float azimuth = u_azimuths[0] + PI;
    float slope_stength = atan(length(deriv)) * 2.0/PI;
    float aspect_strength = 1.0 - abs(mod((aspect + azimuth) / PI + 0.5, 2.0) - 1.0);
    float shadow_strength = slope_stength * aspect_strength;
    float highlight_strength = slope_stength * (1.0-aspect_strength);
    fragColor = u_shadows[0] * shadow_strength + u_highlights[0] * highlight_strength;
}

// MapLibre's legacy hillshade algorithm
void standard_hillshade(vec2 deriv)
{
    // We add PI to make this property match the global light object, which adds PI/2 to the light's azimuthal
    // position property to account for 0deg corresponding to north/the top of the viewport in the style spec
    // and the original shader was written to accept (-illuminationDirection - 90) as the azimuthal.
    float azimuth = u_azimuths[0] + PI;

    // We also multiply the slope by an arbitrary z-factor of 0.625
    float slope = atan(0.625 * length(deriv));
    float aspect = get_aspect(deriv);

    float intensity = u_exaggeration;

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
    vec4 shade_color = mix(u_shadows[0], u_highlights[0], shade) * sin(scaledSlope) * clamp(intensity * 2.0, 0.0, 1.0);
    fragColor = accent_color * (1.0 - shade_color.a) + shade_color;
}

// Based on GDALHillshadeAlg(). (https://github.com/OSGeo/gdal/blob/ad4280be5aee202eea412c075e4591878aaeb018/apps/gdaldem_lib.cpp#L908)
// GDAL's output ranges from black to white, and is gray in the middle.
// The output of this function ranges from hillshade-shadow-color to hillshade-highlight-color, and
// is transparent in the middle. To match GDAL's output, make hillshade-highlight-color white,
// hillshade-shadow color black, and the background color gray.
void basic_hillshade(vec2 deriv)
{
    deriv = deriv * u_exaggeration * 2.0;
    float azimuth = u_azimuths[0] + PI;
    float cos_az = cos(azimuth);
    float sin_az = sin(azimuth);
    float cos_alt = cos(u_altitudes[0]);
    float sin_alt = sin(u_altitudes[0]);

    float cang = (sin_alt - (deriv.y*cos_az*cos_alt - deriv.x*sin_az*cos_alt)) / sqrt(1.0 + dot(deriv, deriv));

    float shade = clamp(cang, 0.0, 1.0);
    if(shade > 0.5)
    {
        fragColor = u_highlights[0]*(2.0*shade - 1.0);
    }
    else
    {
        fragColor = u_shadows[0]*(1.0 - 2.0*shade);
    }
}

// This functioon applies the basic_hillshade algorithm across multiple independent light sources.
// The final color is the average of the contribution from each light source.
void multidirectional_hillshade(vec2 deriv)
{
    deriv = deriv * u_exaggeration * 2.0;
    fragColor = vec4(0,0,0,0);

    for(int i = 0; i < NUM_ILLUMINATION_SOURCES; i++)
    {
        float cos_alt = cos(u_altitudes[i]);
        float sin_alt = sin(u_altitudes[i]);
        float cos_az = -cos(u_azimuths[i]);
        float sin_az = -sin(u_azimuths[i]);

        float cang = (sin_alt - (deriv.y*cos_az*cos_alt - deriv.x*sin_az*cos_alt)) / sqrt(1.0 + dot(deriv, deriv));

        float shade = clamp(cang, 0.0, 1.0);

        if(shade > 0.5)
        {
            fragColor += u_highlights[i]*(2.0*shade - 1.0)/float(NUM_ILLUMINATION_SOURCES);
        }
        else
        {
            fragColor += u_shadows[i]*(1.0 - 2.0*shade)/float(NUM_ILLUMINATION_SOURCES);
        }
    }
}

// Based on GDALHillshadeCombinedAlg(). (https://github.com/OSGeo/gdal/blob/ad4280be5aee202eea412c075e4591878aaeb018/apps/gdaldem_lib.cpp#L1084)
// GDAL's version only calculates shading.
// This version also adds highlighting. To match GDAL's output, make hillshade-highlight-color transparent.
void combined_hillshade(vec2 deriv)
{
    deriv = deriv * u_exaggeration * 2.0;
    float azimuth = u_azimuths[0] + PI;
    float cos_az = cos(azimuth);
    float sin_az = sin(azimuth);
    float cos_alt = cos(u_altitudes[0]);
    float sin_alt = sin(u_altitudes[0]);

    float cang = acos((sin_alt - (deriv.y*cos_az*cos_alt - deriv.x*sin_az*cos_alt)) / sqrt(1.0 + dot(deriv, deriv)));

    cang = clamp(cang, 0.0, PI/2.0);

    float shade = cang* atan(length(deriv)) * 4.0/PI/PI;
    float highlight = (PI/2.0-cang)* atan(length(deriv)) * 4.0/PI/PI;

    fragColor = u_shadows[0]*shade + u_highlights[0]*highlight;
}

void main() {
    vec4 pixel = texture(u_image, v_pos);

    // We divide the slope by a scale factor based on the cosin of the pixel's approximate latitude
    // to account for mercator projection distortion. see #4807 for details
    float scaleFactor = cos(radians((u_latrange[0] - u_latrange[1]) * (1.0 - v_pos.y) + u_latrange[1]));

    vec2 deriv = ((pixel.rg * 8.0) - 4.0) / scaleFactor;

    if (u_method == BASIC) {
        basic_hillshade(deriv);
    } else if (u_method == COMBINED) {
        combined_hillshade(deriv);
    } else if (u_method == IGOR) {
        igor_hillshade(deriv);
    } else if (u_method == MULTIDIRECTIONAL) {
        multidirectional_hillshade(deriv);
    } else if (u_method == STANDARD) {
        standard_hillshade(deriv);
    } else {
        standard_hillshade(deriv);
    }

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
