#define SDF_PX 8.0

uniform bool u_is_halo;
uniform sampler2D u_texture;
uniform sampler2D u_texture_2;
uniform highp float u_gamma_scale;
uniform lowp float u_device_pixel_ratio;
uniform bool u_is_text;
uniform highp vec2 u_texsize;
uniform highp float u_size;

in vec2 v_data0;
in vec3 v_data1;

#pragma mapbox: define highp vec4 fill_color
#pragma mapbox: define highp vec4 halo_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float halo_width
#pragma mapbox: define lowp float halo_blur

float median(vec3 values) {
    return max(min(values.r, values.g), min(max(values.r, values.g), values.b));
}

float screenPxRange(float fontScale) {
    // WebGL1 doesn't support derivatives and we can't use version 300
    // due to https://github.com/maplibre/maplibre-gl-js/pull/2656
    // Instead of doing the actual computation, we just return a single value
    // TODO: This should be a uniform that contains the value of
    // fontScale * sdfPixelRange
    // See https://github.com/Chlumsky/msdfgen?tab=readme-ov-file
    
    return fontScale * SDF_PX;
}

vec4 renderText(vec4 fill_color, vec4 halo_color, float opacity, float halo_width, float halo_blur, float EDGE_GAMMA, vec2 tex, float gamma_scale, float size, float fade_opacity) {

    float fontScale = size / 24.0;

    lowp vec4 color = fill_color;
    highp float gamma = EDGE_GAMMA / (fontScale * u_gamma_scale);
    lowp float inner_edge = (256.0 - 64.0) / 256.0;
    if (u_is_halo) {
        color = halo_color;
        gamma = (halo_blur * 1.19 / SDF_PX + EDGE_GAMMA) / (fontScale * u_gamma_scale);
        inner_edge = inner_edge + gamma * gamma_scale;
    }

    lowp float dist = texture(u_texture, tex).a;
    highp float gamma_scaled = gamma * gamma_scale;
    highp float alpha = smoothstep(inner_edge - gamma_scaled, inner_edge + gamma_scaled, dist);
    if (u_is_halo) {
        // When drawing halos, we want the inside of the halo to be transparent as well
        // in case the text fill is transparent.
        lowp float halo_edge = (6.0 - halo_width / fontScale) / SDF_PX;
        alpha = min(smoothstep(halo_edge - gamma_scaled, halo_edge + gamma_scaled, dist), 1.0 - alpha);
    }

    return color * (alpha * opacity * fade_opacity);
}

vec4 renderMSDFIcon(vec4 fill_color, vec4 halo_color, float opacity, float EDGE_GAMMA, vec2 tex, float gamma_scale, float size, float fade_opacity) {

    float fontScale = size;

    lowp vec4 color = fill_color;
    highp float gamma = EDGE_GAMMA / (fontScale * u_gamma_scale);
    lowp float inner_edge = (256.0 - 64.0) / 256.0;

    vec3 s = texture(u_texture, tex).rgb;
    float sd = median(s);
    float dist = sd - 0.5;

    if (u_is_halo) {
        color = halo_color;
        s = texture(u_texture_2, tex).rgb;
        sd = median(s);
        dist = sd - 0.5;
    }

    float clampedDistance = clamp(dist * screenPxRange(fontScale) + 0.5, 0.0, 1.0);
    
    highp float gamma_scaled = gamma * gamma_scale;
    highp float alpha = smoothstep(inner_edge - gamma_scaled, inner_edge + gamma_scaled, clampedDistance);

    return color * (alpha * opacity * fade_opacity);
}

void main() {
    #pragma mapbox: initialize highp vec4 fill_color
    #pragma mapbox: initialize highp vec4 halo_color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float halo_width
    #pragma mapbox: initialize lowp float halo_blur

    float EDGE_GAMMA = 0.105 / u_device_pixel_ratio;

    vec2 tex = v_data0.xy;
    float gamma_scale = v_data1.x;
    float size = v_data1.y;
    float fade_opacity = v_data1[2];

    fragColor = u_is_text ? renderText(fill_color, halo_color, opacity, halo_width, halo_blur, EDGE_GAMMA, tex, gamma_scale, size, fade_opacity) : renderMSDFIcon(fill_color, halo_color, opacity, EDGE_GAMMA, tex, gamma_scale, size, fade_opacity);

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}