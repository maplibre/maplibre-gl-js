#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_image;
in vec2 v_pos;


uniform vec2 u_dimension;
uniform float u_zoom;
uniform vec4 u_unpack;

float getElevation(ivec2 texel) {
    // Convert encoded elevation value to meters
    vec4 data = texelFetch(u_image, texel, 0) * 255.0;
    data.a = -1.0;
    return dot(data, u_unpack);
}

void main() {
    ivec2 pos = ivec2(gl_FragCoord.xy) + ivec2(1);
    float tileSize = u_dimension.x - 2.0;

    // queried pixels:
    // +-----------+
    // |   |   |   |
    // | a | b | c |
    // |   |   |   |
    // +-----------+
    // |   |   |   |
    // | d | e | f |
    // |   |   |   |
    // +-----------+
    // |   |   |   |
    // | g | h | i |
    // |   |   |   |
    // +-----------+

    float a = getElevation(pos + ivec2(-1, -1));
    float b = getElevation(pos + ivec2(0, -1));
    float c = getElevation(pos + ivec2(1, -1));
    float d = getElevation(pos + ivec2(-1, 0));
    float e = getElevation(pos);
    float f = getElevation(pos + ivec2(1, 0));
    float g = getElevation(pos + ivec2(-1, 1));
    float h = getElevation(pos + ivec2(0, 1));
    float i = getElevation(pos + ivec2(1, 1));

    // Here we divide the x and y slopes by 8 * pixel size
    // where pixel size (aka meters/pixel) is:
    // circumference of the world / (pixels per tile * number of tiles)
    // which is equivalent to: 8 * 40075016.6855785 / (tileSize * pow(2, u_zoom))
    // which can be reduced to: pow(2, 28.25619978527 - u_zoom) / tileSize.
    // We want to vertically exaggerate the hillshading because otherwise
    // it is barely noticeable at low zooms. To do this, we multiply this by
    // a scale factor that is a function of zooms below 15, which is an arbitrary
    // that corresponds to the max zoom level of Mapbox terrain-RGB tiles.
    // See nickidlugash's awesome breakdown for more info:
    // https://github.com/mapbox/mapbox-gl-js/pull/5286#discussion_r148419556

    float exaggerationFactor = u_zoom < 2.0 ? 0.4 : u_zoom < 4.5 ? 0.35 : 0.3;
    float exaggeration = u_zoom < 15.0 ? (u_zoom - 15.0) * exaggerationFactor : 0.0;

    vec2 deriv = vec2(
        (c + f + f + i) - (a + d + d + g),
        (g + h + h + i) - (a + b + b + c)
    ) * tileSize / pow(2.0, exaggeration + (28.2562 - u_zoom));

    fragColor = clamp(vec4(
        deriv.x / 8.0 + 0.5,
        deriv.y / 8.0 + 0.5,
        1.0,
        1.0), 0.0, 1.0);

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
