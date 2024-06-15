
// Disable Flow annotations here because Flow doesn't support importing GLSL files

import preludeFrag from './_prelude.fragment.glsl.g.ts';
import preludeVert from './_prelude.vertex.glsl.g.ts';
import backgroundFrag from './background.fragment.glsl.g.ts';
import backgroundVert from './background.vertex.glsl.g.ts';
import backgroundPatternFrag from './background_pattern.fragment.glsl.g.ts';
import backgroundPatternVert from './background_pattern.vertex.glsl.g.ts';
import circleFrag from './circle.fragment.glsl.g.ts';
import circleVert from './circle.vertex.glsl.g.ts';
import clippingMaskFrag from './clipping_mask.fragment.glsl.g.ts';
import clippingMaskVert from './clipping_mask.vertex.glsl.g.ts';
import heatmapFrag from './heatmap.fragment.glsl.g.ts';
import heatmapVert from './heatmap.vertex.glsl.g.ts';
import heatmapTextureFrag from './heatmap_texture.fragment.glsl.g.ts';
import heatmapTextureVert from './heatmap_texture.vertex.glsl.g.ts';
import collisionBoxFrag from './collision_box.fragment.glsl.g.ts';
import collisionBoxVert from './collision_box.vertex.glsl.g.ts';
import collisionCircleFrag from './collision_circle.fragment.glsl.g.ts';
import collisionCircleVert from './collision_circle.vertex.glsl.g.ts';
import debugFrag from './debug.fragment.glsl.g.ts';
import debugVert from './debug.vertex.glsl.g.ts';
import fillFrag from './fill.fragment.glsl.g.ts';
import fillVert from './fill.vertex.glsl.g.ts';
import fillOutlineFrag from './fill_outline.fragment.glsl.g.ts';
import fillOutlineVert from './fill_outline.vertex.glsl.g.ts';
import fillOutlinePatternFrag from './fill_outline_pattern.fragment.glsl.g.ts';
import fillOutlinePatternVert from './fill_outline_pattern.vertex.glsl.g.ts';
import fillPatternFrag from './fill_pattern.fragment.glsl.g.ts';
import fillPatternVert from './fill_pattern.vertex.glsl.g.ts';
import fillExtrusionFrag from './fill_extrusion.fragment.glsl.g.ts';
import fillExtrusionVert from './fill_extrusion.vertex.glsl.g.ts';
import fillExtrusionPatternFrag from './fill_extrusion_pattern.fragment.glsl.g.ts';
import fillExtrusionPatternVert from './fill_extrusion_pattern.vertex.glsl.g.ts';
import hillshadePrepareFrag from './hillshade_prepare.fragment.glsl.g.ts';
import hillshadePrepareVert from './hillshade_prepare.vertex.glsl.g.ts';
import hillshadeFrag from './hillshade.fragment.glsl.g.ts';
import hillshadeVert from './hillshade.vertex.glsl.g.ts';
import lineFrag from './line.fragment.glsl.g.ts';
import lineVert from './line.vertex.glsl.g.ts';
import lineGradientFrag from './line_gradient.fragment.glsl.g.ts';
import lineGradientVert from './line_gradient.vertex.glsl.g.ts';
import linePatternFrag from './line_pattern.fragment.glsl.g.ts';
import linePatternVert from './line_pattern.vertex.glsl.g.ts';
import lineSDFFrag from './line_sdf.fragment.glsl.g.ts';
import lineSDFVert from './line_sdf.vertex.glsl.g.ts';
import rasterFrag from './raster.fragment.glsl.g.ts';
import rasterVert from './raster.vertex.glsl.g.ts';
import symbolIconFrag from './symbol_icon.fragment.glsl.g.ts';
import symbolIconVert from './symbol_icon.vertex.glsl.g.ts';
import symbolSDFFrag from './symbol_sdf.fragment.glsl.g.ts';
import symbolSDFVert from './symbol_sdf.vertex.glsl.g.ts';
import symbolTextAndIconFrag from './symbol_text_and_icon.fragment.glsl.g.ts';
import symbolTextAndIconVert from './symbol_text_and_icon.vertex.glsl.g.ts';
import terrainDepthFrag from './terrain_depth.fragment.glsl.g.ts';
import terrainCoordsFrag from './terrain_coords.fragment.glsl.g.ts';
import terrainFrag from './terrain.fragment.glsl.g.ts';
import terrainVert from './terrain.vertex.glsl.g.ts';

export const shaders = {
    prelude: compile(preludeFrag, preludeVert),
    background: compile(backgroundFrag, backgroundVert),
    backgroundPattern: compile(backgroundPatternFrag, backgroundPatternVert),
    circle: compile(circleFrag, circleVert),
    clippingMask: compile(clippingMaskFrag, clippingMaskVert),
    heatmap: compile(heatmapFrag, heatmapVert),
    heatmapTexture: compile(heatmapTextureFrag, heatmapTextureVert),
    collisionBox: compile(collisionBoxFrag, collisionBoxVert),
    collisionCircle: compile(collisionCircleFrag, collisionCircleVert),
    debug: compile(debugFrag, debugVert),
    fill: compile(fillFrag, fillVert),
    fillOutline: compile(fillOutlineFrag, fillOutlineVert),
    fillOutlinePattern: compile(fillOutlinePatternFrag, fillOutlinePatternVert),
    fillPattern: compile(fillPatternFrag, fillPatternVert),
    fillExtrusion: compile(fillExtrusionFrag, fillExtrusionVert),
    fillExtrusionPattern: compile(fillExtrusionPatternFrag, fillExtrusionPatternVert),
    hillshadePrepare: compile(hillshadePrepareFrag, hillshadePrepareVert),
    hillshade: compile(hillshadeFrag, hillshadeVert),
    line: compile(lineFrag, lineVert),
    lineGradient: compile(lineGradientFrag, lineGradientVert),
    linePattern: compile(linePatternFrag, linePatternVert),
    lineSDF: compile(lineSDFFrag, lineSDFVert),
    raster: compile(rasterFrag, rasterVert),
    symbolIcon: compile(symbolIconFrag, symbolIconVert),
    symbolSDF: compile(symbolSDFFrag, symbolSDFVert),
    symbolTextAndIcon: compile(symbolTextAndIconFrag, symbolTextAndIconVert),
    terrain: compile(terrainFrag, terrainVert),
    terrainDepth: compile(terrainDepthFrag, terrainVert),
    terrainCoords: compile(terrainCoordsFrag, terrainVert)
};

// Expand #pragmas to #ifdefs.

function compile(fragmentSource, vertexSource) {
    const re = /#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g;

    const staticAttributes = vertexSource.match(/attribute ([\w]+) ([\w]+)/g);
    const fragmentUniforms = fragmentSource.match(/uniform ([\w]+) ([\w]+)([\s]*)([\w]*)/g);
    const vertexUniforms = vertexSource.match(/uniform ([\w]+) ([\w]+)([\s]*)([\w]*)/g);
    const staticUniforms = vertexUniforms ? vertexUniforms.concat(fragmentUniforms) : fragmentUniforms;

    const fragmentPragmas = {};

    fragmentSource = fragmentSource.replace(re, (match, operation, precision, type, name) => {
        fragmentPragmas[name] = true;
        if (operation === 'define') {
            return `
#ifndef HAS_UNIFORM_u_${name}
varying ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
        } else /* if (operation === 'initialize') */ {
            return `
#ifdef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = u_${name};
#endif
`;
        }
    });

    vertexSource = vertexSource.replace(re, (match, operation, precision, type, name) => {
        const attrType = type === 'float' ? 'vec2' : 'vec4';
        const unpackType = name.match(/color/) ? 'color' : attrType;

        if (fragmentPragmas[name]) {
            if (operation === 'define') {
                return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float u_${name}_t;
attribute ${precision} ${attrType} a_${name};
varying ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
            } else /* if (operation === 'initialize') */ {
                if (unpackType === 'vec4') {
                    // vec4 attributes are only used for cross-faded properties, and are not packed
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${name} = a_${name};
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                } else {
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${name} = unpack_mix_${unpackType}(a_${name}, u_${name}_t);
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                }
            }
        } else {
            if (operation === 'define') {
                return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float u_${name}_t;
attribute ${precision} ${attrType} a_${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
            } else /* if (operation === 'initialize') */ {
                if (unpackType === 'vec4') {
                    // vec4 attributes are only used for cross-faded properties, and are not packed
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = a_${name};
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                } else /* */ {
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = unpack_mix_${unpackType}(a_${name}, u_${name}_t);
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                }
            }
        }
    });

    return {fragmentSource, vertexSource, staticAttributes, staticUniforms};
}
