uniform bool u_scale_with_map;
uniform bool u_pitch_with_map;
uniform vec2 u_extrude_scale;
uniform highp float u_globe_extrude_scale;
uniform lowp float u_device_pixel_ratio;
uniform highp float u_camera_to_center_distance;

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

// Interaction of globe (3D) with circle-pitch-alignment + circle-pitch-scale.
// This is a summary of behaviour, where "v" stands for "viewport" and "m" for map.
// First letter is alignment, second is scale.
// v+v:
//   2D: circles have constant screenspace size
//   3D: same as 2D
// v+m:
//   2D: circles have constant screenspace size, far away circles are shrunk, like with perspective projection (only has effect if map is pitched)
//   3D: same as 2D
// m+v:
//   2D: circles "printed" onto map surface, far away circles are enlarged (counteracts shirnking due to perspective projection)
//   3D: circles "printed" onto map surface, far away circles are enlarged (implemented but questionable whether it does anything)
// m+m:
//   2D: circles "printed" onto map surface, far away circles are naturally smaller due to perspective projection
//   3D: circles "printed" onto globe surface, far away circles are naturally smaller due to perspective projectionp
// JP: TODO: put this into style specs

void main(void) {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize mediump float radius
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize highp vec4 stroke_color
    #pragma mapbox: initialize mediump float stroke_width
    #pragma mapbox: initialize lowp float stroke_opacity

    // unencode the extrusion vector that we snuck into the a_pos vector
    vec2 extrude = vec2(mod(a_pos, 2.0) * 2.0 - 1.0);

    // multiply a_pos by 0.5, since we had it * 2 in order to sneak
    // in extrusion data
    vec2 circle_center = floor(a_pos * 0.5);
    float ele = get_elevation(circle_center);
    v_visibility = calculate_visibility(projectTileWithElevation(vec3(circle_center, ele)));

    if (u_pitch_with_map) {
        vec3 center_vector = projectToSphere(circle_center);

        // This var is only used when globe is enabled and defined.
        float angle = (extrude.x > 0.0) ? u_globe_extrude_scale : -u_globe_extrude_scale; // TODO maybe wrong sign

        // Keep track of "2D" corner position to allow smooth interpolation between globe and mercator
        vec2 corner_position = circle_center;
        if (u_scale_with_map) {
            angle *= (radius + stroke_width);
            corner_position += extrude * u_extrude_scale * (radius + stroke_width);
        } else {
            // Pitching the circle with the map effectively scales it with the map
            // To counteract the effect for pitch-scale: viewport, we rescale the
            // whole circle based on the pitch scaling effect at its central point
            vec4 projected_center = interpolateProjection(circle_center, center_vector);
            corner_position += extrude * u_extrude_scale * (radius + stroke_width) * (projected_center.w / u_camera_to_center_distance);
            angle *= (radius + stroke_width) * (projected_center.w / u_camera_to_center_distance);
        }

#ifdef GLOBE
        // Default axis for vertical rotation
        vec3 axis = vec3(-center_vector.z, 0.0, center_vector.x); // Equivalent to cross(center_vector, vec3(0.0, 1.0, 0.0))
        if ((extrude.x > 0.0) != (extrude.y > 0.0)) {
            // Move corner horizontally instead of vertically
            axis = cross(center_vector, axis);
        }
        axis = normalize(axis);
        
        mat3 m = rotationMatrixFromAxisAngle(axis, angle);
        vec3 corner_vector = m * center_vector;
        gl_Position = interpolateProjection(circle_center, corner_vector);
#else
        gl_Position = projectTileWithElevation(vec3(corner_position, ele));
#endif
    } else {
        gl_Position = projectTileWithElevation(vec3(circle_center, ele));

        if (u_scale_with_map) {
            gl_Position.xy += extrude * (radius + stroke_width) * u_extrude_scale * u_camera_to_center_distance;
        } else {
            gl_Position.xy += extrude * (radius + stroke_width) * u_extrude_scale * gl_Position.w;
        }
    }

    // This is a minimum blur distance that serves as a faux-antialiasing for
    // the circle. since blur is a ratio of the circle's size and the intent is
    // to keep the blur at roughly 1px, the two are inversely related.
    lowp float antialiasblur = 1.0 / u_device_pixel_ratio / (radius + stroke_width);

    v_data = vec3(extrude.x, extrude.y, antialiasblur);
}
