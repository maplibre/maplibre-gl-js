uniform float u_ao_ground_radius;
uniform float u_tile_units_per_meter;
uniform vec2 u_fill_translate;

layout(location = 0) in vec2 a_pos;
layout(location = 1) in ivec4 a_normal_ed;

// All four as tile units; v_along runs from the wall's first end.
out highp float v_along;
out highp float v_length;
out highp float v_across;
out highp float v_reach;
out lowp float v_opacity;

#pragma maplibre: define highp float base
#pragma maplibre: define highp float height
#pragma maplibre: define highp float opacity

void main() {
    #pragma maplibre: initialize highp float base
    #pragma maplibre: initialize highp float height
    #pragma maplibre: initialize highp float opacity

    opacity = clamp(opacity, 0.0, 1.0);
    if ((a_normal_ed.x == 1 && a_normal_ed.y == 0) || opacity <= 0.0) {
        // Roofs and fully transparent features draw nothing.
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
    }

    float reach = (base > 0.0 ? 0.0 : min(u_ao_ground_radius, 2.0 * max(0.0, height))) * u_tile_units_per_meter;

    // Packed by wallEndData.
    int wallEnd = a_normal_ed.z;
    bool isFirstEnd = wallEnd > 0;
    float wallLength = float(abs(wallEnd) >> 1);
    float cap = float(abs(wallEnd) & 1) * reach;

    vec2 inward = vec2(a_normal_ed.xy) / 16384.0;
    vec2 along = vec2(-inward.y, inward.x);
    float t = float(a_normal_ed.x & 1);

    // The foot tucks under the wall so no pixel falls between the wall's bottom edge and the strip.
    float across = t > 0.0 ? reach : -0.01 * reach;
    vec2 groundPos = a_pos + along * (isFirstEnd ? -cap : cap) - inward * across;
    vec2 posInTile = groundPos + u_fill_translate;

    gl_Position = projectTileFor3D(posInTile, 0.0);

    v_along = isFirstEnd ? -cap : wallLength + cap;
    v_length = wallLength;
    v_across = across;
    v_reach = reach;
    v_opacity = opacity;
}
