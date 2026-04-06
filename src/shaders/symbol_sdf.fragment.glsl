#define SDF_PX 8.0

uniform bool u_is_halo;
uniform sampler2D u_texture;
uniform highp float u_gamma_scale;
uniform lowp float u_device_pixel_ratio;
uniform bool u_is_text;

in vec2 v_data0;
in vec3 v_data1;

#pragma mapbox: define highp vec4 fill_color
#pragma mapbox: define highp vec4 halo_color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float halo_width
#pragma mapbox: define lowp float halo_blur

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

    float fontScale = u_is_text ? size / 24.0 : size;

    lowp vec4 color = fill_color;
    highp float gamma = EDGE_GAMMA / (fontScale * u_gamma_scale);
    lowp float inner_edge = (256.0 - 64.0) / 256.0;
    /*if (u_is_halo) {
        //color = halo_color;
        float gamma_halo = (halo_blur * 1.19 / SDF_PX + EDGE_GAMMA) / (fontScale * u_gamma_scale);
        float inner_edge_halo = inner_edge + gamma_halo * gamma_scale;
    }*/

    lowp float dist = texture(u_texture, tex).a;
    highp float gamma_scaled = gamma * gamma_scale;
    highp float alpha = smoothstep(inner_edge - gamma_scaled, inner_edge + gamma_scaled, dist);

    if (u_is_halo) {
        float gamma_halo = (halo_blur * 1.19 / SDF_PX + EDGE_GAMMA) / (fontScale * u_gamma_scale);
        float inner_edge_halo = inner_edge + gamma_halo * gamma_scale;
        highp float gamma_scaled_halo = gamma_halo * gamma_scale;
        highp float alpha_halo = smoothstep(inner_edge_halo - gamma_scaled_halo, inner_edge_halo + gamma_scaled_halo, dist);

        // When drawing halos, we want the inside of the halo to be transparent as well
        // in case the text fill is transparent.
        lowp float halo_edge = (6.0 - halo_width / fontScale) / SDF_PX;
        alpha_halo = min(smoothstep(halo_edge - gamma_scaled_halo, halo_edge + gamma_scaled_halo, dist), 1.0 - alpha_halo);

        /*color.rgb = mix(halo_color.rgb * (1. - alpha), color.rgb, vec3(alpha));
        color.a = mix(halo_color.a, color.a, alpha);
        alpha = 1. - (1. - alpha) * (1. - alpha_halo);*/

        /*vec4 out_color = color * (alpha * opacity * fade_opacity);
        vec4 out_color_halo = vec4(fill_color.rgb, fill_color.a * alpha_halo * opacity * fade_opacity);

        fragColor = vec4(mix(out_color_halo.rgb, out_color.rgb, alpha), 1. - (1. - alpha) * (1. - alpha_halo));
        //fragColor = vec4(1., 0., 0., 1.);

        fragColor = out_color_halo;*/
        color.rgb = mix(halo_color.rgb * (1. - alpha), color.rgb, vec3(alpha));
        color.a = mix(halo_color.a, color.a, alpha);
        alpha = 1. - (1. - alpha) * (1. - alpha_halo);
        //fragColor = color * (alpha * opacity * fade_opacity);
        //fragColor = vec4(1., 0., 0., 1.);
        //return;
    }

    fragColor = color * (alpha * opacity * fade_opacity);

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
