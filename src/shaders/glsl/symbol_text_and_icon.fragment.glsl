#define SDF_PX 8.0

#define SDF 1.0
#define ICON 0.0

uniform bool u_is_halo;
uniform bool u_is_text;
uniform sampler2D u_texture;
uniform sampler2D u_texture_icon;
uniform highp float u_gamma_scale;
uniform lowp float u_device_pixel_ratio;

in vec4 v_data0;
in vec4 v_data1;

#pragma mapbox: define highp vec4 fill_color
#pragma mapbox: define highp vec4 halo_color
#pragma mapbox: define lowp float halo_width
#pragma mapbox: define lowp float halo_blur

void main() {
    #pragma mapbox: initialize highp vec4 fill_color
    #pragma mapbox: initialize highp vec4 halo_color
    #pragma mapbox: initialize lowp float halo_width
    #pragma mapbox: initialize lowp float halo_blur

    float total_opacity = v_data1[2];

    if (v_data1.w == ICON) {
        vec2 tex_icon = v_data0.zw;
        fragColor = texture(u_texture_icon, tex_icon) * total_opacity;

#ifdef OVERDRAW_INSPECTOR
        fragColor = vec4(1.0);
#endif
        return;
    }

    vec2 tex = v_data0.xy;

    float EDGE_GAMMA = 0.105 / u_device_pixel_ratio;

    float gamma_scale = v_data1.x;
    float size = v_data1.y;

    float fontScale = size / 24.0;

    highp float gamma = EDGE_GAMMA / (fontScale * u_gamma_scale);
    lowp float buff = (256.0 - 64.0) / 256.0;
    lowp float dist = texture(u_texture, tex).a;

    lowp vec4 color_alpha_out, color_alpha_out_halo;
    if (u_is_text) {
        highp float gamma_scaled = gamma * gamma_scale;
        highp float alpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, dist);
        color_alpha_out = fill_color * (alpha * total_opacity);
    }
    if (u_is_halo) {
        highp float gamma_halo = (halo_blur * 1.19 / SDF_PX + EDGE_GAMMA) / (fontScale * u_gamma_scale);
        lowp float buff_halo = (6.0 - halo_width / fontScale) / SDF_PX;

        highp float gamma_scaled_halo = gamma_halo * gamma_scale;
        highp float alpha_halo = smoothstep(buff_halo - gamma_scaled_halo, buff_halo + gamma_scaled_halo, dist);

        color_alpha_out_halo = halo_color * (alpha_halo * total_opacity);
    }

    if (u_is_text && u_is_halo) {
        fragColor = color_alpha_out + (1. - color_alpha_out.a) * color_alpha_out_halo;
    } else if (u_is_halo) {
        fragColor = color_alpha_out_halo;
    } else {
        fragColor = color_alpha_out;
    }

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
