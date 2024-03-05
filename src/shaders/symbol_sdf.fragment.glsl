#extension GL_OES_standard_derivatives : enable

#define SDF_PX 8.0

uniform bool u_is_halo;
uniform sampler2D u_texture;
uniform highp float u_gamma_scale;
uniform lowp float u_device_pixel_ratio;
uniform bool u_is_text;
uniform lowp float u_my_width;
uniform lowp float u_my_height;

in vec2 v_data0;
in vec3 v_data1;

#pragma mapbox: define highp vec4 fill_color
#pragma mapbox: define highp vec4 halo_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float halo_width
#pragma mapbox: define lowp float halo_blur

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

float screenPxRange() {
    vec2 unitRange = vec2(8.0) / vec2(u_my_width, u_my_height);
    vec2 screenTexSize = vec2(1.0) / fwidth(v_data0.xy);
    return max(0.5 * dot(unitRange, screenTexSize), 1.0);
}

void main() {
    #pragma mapbox: initialize highp vec4 fill_color
    #pragma mapbox: initialize highp vec4 halo_color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float halo_width
    #pragma mapbox: initialize lowp float halo_blur

    vec2 tex = v_data0.xy;
    float size = v_data1.y;
    float fade_opacity = v_data1[2];

    float fontScale = u_is_text ? size / 24.0 : size;

    lowp vec4 color = fill_color;

    vec3 s = texture(u_texture, tex).rgb;
    float sd = median(s.r, s.g, s.b);
    float dist = 0.0;
    
    if (u_is_halo) {
        color = halo_color;
        // use halo_blur as to make inner bigger
        dist = (sd - 0.5 + halo_blur + halo_width); // * 6.0 * fontScale;
    }
    else {
        dist = (sd - 0.5 + halo_blur); // * 6.0 * fontScale;
    }

    float alpha = clamp(dist * screenPxRange()  + 0.5, 0.0, 1.0);
   
    fragColor = color * (alpha * opacity * fade_opacity);

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
