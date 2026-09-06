#pragma maplibre: define highp vec4 color
#pragma maplibre: define lowp float opacity

void main() {
    #pragma maplibre: initialize highp vec4 color
    #pragma maplibre: initialize lowp float opacity

    fragColor = color * opacity;

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
