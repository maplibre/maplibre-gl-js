#pragma maplibre: define highp vec4 color
#pragma maplibre: define lowp float opacity
#ifdef ROUNDED_CORNERS
#pragma maplibre: define highp vec4 outline_color
#endif

void main() {
    #pragma maplibre: initialize highp vec4 color
    #pragma maplibre: initialize lowp float opacity
#ifdef ROUNDED_CORNERS
    #pragma maplibre: initialize highp vec4 outline_color
#endif

    fragColor = color * opacity;

#ifdef ROUNDED_CORNERS
    fragColor = rounded_corner_color(fragColor, outline_color * opacity);
#endif

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
