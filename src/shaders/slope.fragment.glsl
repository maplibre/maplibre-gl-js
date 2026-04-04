#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_image;
uniform vec4 u_unpack;
uniform sampler2D u_slope_stops;
uniform sampler2D u_color_stops;
uniform int u_color_ramp_size;
uniform float u_opacity;
uniform vec2 u_latrange;
uniform vec2 u_dimension;
uniform float u_zoom;

in vec2 v_pos;

#define PI 3.141592653589793

float getElevation(vec2 coord) {
    vec4 data = texture(u_image, coord) * 255.0;
    data.a = -1.0;
    return dot(data, u_unpack);
}

float getSlopeStop(int stop) {
    float x = (float(stop)+0.5)/float(u_color_ramp_size);
    vec4 data = texture(u_slope_stops, vec2(x, 0));
    // Slope is stored as: R channel = slope / 90.0 (normalized to 0-1 range)
    return data.r * 90.0;
}

void main() {
    vec2 epsilon = 1.0 / u_dimension;
    float tileSize = u_dimension.x - 2.0;

    // Sample 3x3 neighborhood for Horn algorithm
    float a = getElevation(v_pos + vec2(-epsilon.x, -epsilon.y));
    float b = getElevation(v_pos + vec2(0, -epsilon.y));
    float c = getElevation(v_pos + vec2(epsilon.x, -epsilon.y));
    float d = getElevation(v_pos + vec2(-epsilon.x, 0));
    float f = getElevation(v_pos + vec2(epsilon.x, 0));
    float g = getElevation(v_pos + vec2(-epsilon.x, epsilon.y));
    float h = getElevation(v_pos + vec2(0, epsilon.y));
    float i = getElevation(v_pos + vec2(epsilon.x, epsilon.y));

    // Horn (1981) algorithm for gradient computation
    // Raw pixel-space derivatives (not yet divided by cell size)
    float dzdx = (c + 2.0*f + i) - (a + 2.0*d + g);
    float dzdy = (g + 2.0*h + i) - (a + 2.0*b + c);

    // Convert from pixel-space to meter-space derivatives.
    // Cell size in meters = earth_circumference / (tileSize * 2^zoom)
    // The factor 8 from Horn's algorithm is combined with the cell size:
    // 8 * cellsize = 8 * 40075016.6855785 / (tileSize * 2^zoom)
    //             = pow(2, 28.2562 - zoom) / tileSize  (approx)
    // We multiply derivatives by tileSize / pow(2, 28.2562 - zoom) to normalize.
    vec2 deriv = vec2(dzdx, dzdy) * tileSize / pow(2.0, 28.2562 - u_zoom);

    // Account for Mercator projection latitude distortion on the x-axis
    float lat = (u_latrange[0] - u_latrange[1]) * (1.0 - v_pos.y) + u_latrange[1];
    deriv.x = deriv.x / cos(radians(lat));

    // Compute slope angle in degrees
    // The derivatives are now dz/dx and dz/dy in meters/meter, already divided by 8*cellsize.
    // slope = atan(sqrt((dz/dx)^2 + (dz/dy)^2))
    float gradient = length(deriv);
    float slope_radians = atan(gradient);
    float slope_degrees = slope_radians * (180.0 / PI);

    // Clamp slope to valid range [0, 90]
    slope_degrees = clamp(slope_degrees, 0.0, 90.0);

    // Binary search for color ramp interpolation
    int r = (u_color_ramp_size - 1);
    int l = 0;
    float slope_l = getSlopeStop(l);
    float slope_r = getSlopeStop(r);
    while(r - l > 1)
    {
        int m = (r + l) / 2;
        float slope_m = getSlopeStop(m);
        if(slope_degrees < slope_m)
        {
            r = m;
            slope_r = slope_m;
        }
        else
        {
            l = m;
            slope_l = slope_m;
        }
    }

    float x = (float(l) + (slope_degrees - slope_l) / (slope_r - slope_l) + 0.5)/float(u_color_ramp_size);
    fragColor = u_opacity*texture(u_color_stops, vec2(x, 0));

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
