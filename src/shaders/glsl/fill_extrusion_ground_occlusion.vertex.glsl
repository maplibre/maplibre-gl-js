uniform lowp float u_ao_ground_intensity;
uniform float u_ao_ground_radius;
uniform float u_ao_ground_tuck;
uniform float u_tile_units_per_meter;
uniform vec2 u_fill_translate;

layout(location = 0) in vec2 a_pos;
#ifndef COMPOSITE
layout(location = 1) in ivec4 a_normal_ed;

// Normalized by reach; v_along runs from the wall's first end.
out highp float v_along;
out highp float v_length;
out highp float v_across;
out lowp float v_intensity;

#pragma maplibre: define highp float base
#pragma maplibre: define highp float height
#pragma maplibre: define highp float opacity
#endif

void main() {
#ifdef COMPOSITE
    gl_Position = projectTileFor3D(a_pos, 0.0);
#else
    #pragma maplibre: initialize highp float base
    #pragma maplibre: initialize highp float height
    #pragma maplibre: initialize highp float opacity

    opacity = clamp(opacity, 0.0, 1.0);
    float reach = (base > 0.0 ? 0.0 : min(u_ao_ground_radius, 2.0 * max(0.0, height))) * u_tile_units_per_meter;
    if ((a_normal_ed.x == 1 && a_normal_ed.y == 0) || opacity <= 0.0 || reach <= 0.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
    }

    int wallEnd = a_normal_ed.z;
    bool isFirstEnd = wallEnd > 0;
    float wallLength = float(abs(wallEnd) >> 1);
    float cap = float(abs(wallEnd) & 1);

    vec2 inward = vec2(a_normal_ed.xy) / 16384.0;
    vec2 along = vec2(-inward.y, inward.x);
    float t = float(a_normal_ed.x & 1);

    // The foot tucks under the wall so bilinear upsampling never blends with uncovered interior texels.
    float invReach = 1.0 / reach;
    float across = t > 0.0 ? 1.0 : -clamp(u_ao_ground_tuck * invReach, 0.01, 0.35);
    vec2 groundPos = a_pos + (along * (isFirstEnd ? -cap : cap) - inward * across) * reach;
    gl_Position = projectTileFor3D(groundPos + u_fill_translate, 0.0);

    v_along = isFirstEnd ? -cap : wallLength * invReach + cap;
    v_length = wallLength * invReach;
    v_across = across;
    v_intensity = u_ao_ground_intensity * opacity;
#endif
}
