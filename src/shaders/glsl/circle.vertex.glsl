uniform bool u_scale_with_map;
uniform bool u_pitch_with_map;
uniform vec2 u_extrude_scale;
uniform highp float u_globe_extrude_scale;
uniform lowp float u_device_pixel_ratio;
uniform highp float u_camera_to_center_distance;
uniform vec2 u_translate;

in vec2 a_pos;

out vec3 v_data;
out float v_visibility;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define mediump float radius
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define highp vec4 stroke_color
#pragma mapbox: define mediump float stroke_width
#pragma mapbox: define lowp float stroke_opacity

void main(void) {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize mediump float radius
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize highp vec4 stroke_color
    #pragma mapbox: initialize mediump float stroke_width
    #pragma mapbox: initialize lowp float stroke_opacity

    // decode the extrusion vector that we snuck into the a_pos vector
    vec2 pos_raw = a_pos + 32768.0;
    vec2 extrude = vec2(mod(pos_raw, 8.0) / 7.0 * 2.0 - 1.0);

    // Divide a_pos by 8, since we had it * 8 in order to sneak
    // in extrusion data
    vec2 circle_center = floor(pos_raw / 8.0) + u_translate;
    float ele = get_elevation(circle_center);
    v_visibility = calculate_visibility(projectTileWithElevation(circle_center, ele));

    if (u_pitch_with_map) {
#ifdef GLOBE
        vec3 center_vector = projectToSphere(circle_center);
#endif

        // This var is only used when globe is enabled and defined.
        float angle_scale = u_globe_extrude_scale;

        // Keep track of "2D" corner position to allow smooth interpolation between globe and mercator
        vec2 corner_position = circle_center;
        if (u_scale_with_map) {
            angle_scale *= (radius + stroke_width);
            corner_position += extrude * u_extrude_scale * (radius + stroke_width);
        } else {
            // Pitching the circle with the map effectively scales it with the map
            // To counteract the effect for pitch-scale: viewport, we rescale the
            // whole circle based on the pitch scaling effect at its central point
#ifdef GLOBE
            vec4 projected_center = interpolateProjection(circle_center, center_vector, ele);
#else
            vec4 projected_center = projectTileWithElevation(circle_center, ele);
#endif
            corner_position += extrude * u_extrude_scale * (radius + stroke_width) * (projected_center.w / u_camera_to_center_distance);
            angle_scale *= (radius + stroke_width) * (projected_center.w / u_camera_to_center_distance);
        }

#ifdef GLOBE
        vec2 angles = extrude * angle_scale;
        vec3 corner_vector = globeRotateVector(center_vector, angles);
        gl_Position = interpolateProjection(corner_position, corner_vector, ele);
#else
        gl_Position = projectTileWithElevation(corner_position, ele);
#endif
    } else {
        gl_Position = projectTileWithElevation(circle_center, ele);

        if (gl_Position.z / gl_Position.w > 1.0) {
            // Same as in fill_outline.fragment.glsl and line.fragment.glsl, we need to account for some hardware
            // doing glFragDepth and clipping in the wrong order by doing clipping manually in the shader.
            // For screenspace (not u_pitch_with_map) circles, it is enough to detect whether the anchor
            // point should be clipped here in the vertex shader, and clip it by moving in beyond the
            // renderable range -1..1 in X and Y (moving it to 10000 is more than enough).
            gl_Position.xy = vec2(10000.0);
        }

        if (u_scale_with_map) {
            gl_Position.xy += extrude * (radius + stroke_width) * u_extrude_scale * u_camera_to_center_distance;
        } else {
            gl_Position.xy += extrude * (radius + stroke_width) * u_extrude_scale * gl_Position.w;
        }
    }

    // This is a minimum blur distance that serves as a faux-antialiasing for
    // the circle. since blur is a ratio of the circle's size and the intent is
    // to keep the blur at roughly 1px, the two are inversely related.
    float antialiasblur = -max(1.0 / u_device_pixel_ratio / (radius + stroke_width), blur);

    v_data = vec3(extrude.x, extrude.y, antialiasblur);
}
