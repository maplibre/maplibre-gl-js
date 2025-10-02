// Disable Flow annotations here because Flow doesn't support importing GLSL files

import preludeFrag from './_prelude.fragment.glsl.g';
import preludeVert from './_prelude.vertex.glsl.g';
import backgroundFrag from './background.fragment.glsl.g';
import backgroundVert from './background.vertex.glsl.g';
import backgroundPatternFrag from './background_pattern.fragment.glsl.g';
import backgroundPatternVert from './background_pattern.vertex.glsl.g';
import circleFrag from './circle.fragment.glsl.g';
import circleVert from './circle.vertex.glsl.g';
import clippingMaskFrag from './clipping_mask.fragment.glsl.g';
import clippingMaskVert from './clipping_mask.vertex.glsl.g';
import heatmapFrag from './heatmap.fragment.glsl.g';
import heatmapVert from './heatmap.vertex.glsl.g';
import heatmapTextureFrag from './heatmap_texture.fragment.glsl.g';
import heatmapTextureVert from './heatmap_texture.vertex.glsl.g';
import collisionBoxFrag from './collision_box.fragment.glsl.g';
import collisionBoxVert from './collision_box.vertex.glsl.g';
import collisionCircleFrag from './collision_circle.fragment.glsl.g';
import collisionCircleVert from './collision_circle.vertex.glsl.g';
import colorReliefFrag from './color_relief.fragment.glsl.g';
import colorReliefVert from './color_relief.vertex.glsl.g';
import debugFrag from './debug.fragment.glsl.g';
import debugVert from './debug.vertex.glsl.g';
import depthVert from './depth.vertex.glsl.g';
import fillFrag from './fill.fragment.glsl.g';
import fillVert from './fill.vertex.glsl.g';
import fillOutlineFrag from './fill_outline.fragment.glsl.g';
import fillOutlineVert from './fill_outline.vertex.glsl.g';
import fillOutlinePatternFrag from './fill_outline_pattern.fragment.glsl.g';
import fillOutlinePatternVert from './fill_outline_pattern.vertex.glsl.g';
import fillPatternFrag from './fill_pattern.fragment.glsl.g';
import fillPatternVert from './fill_pattern.vertex.glsl.g';
import fillExtrusionFrag from './fill_extrusion.fragment.glsl.g';
import fillExtrusionVert from './fill_extrusion.vertex.glsl.g';
import fillExtrusionPatternFrag from './fill_extrusion_pattern.fragment.glsl.g';
import fillExtrusionPatternVert from './fill_extrusion_pattern.vertex.glsl.g';
import hillshadePrepareFrag from './hillshade_prepare.fragment.glsl.g';
import hillshadePrepareVert from './hillshade_prepare.vertex.glsl.g';
import hillshadeFrag from './hillshade.fragment.glsl.g';
import hillshadeVert from './hillshade.vertex.glsl.g';
import lineFrag from './line.fragment.glsl.g';
import lineVert from './line.vertex.glsl.g';
import lineGradientFrag from './line_gradient.fragment.glsl.g';
import lineGradientVert from './line_gradient.vertex.glsl.g';
import linePatternFrag from './line_pattern.fragment.glsl.g';
import linePatternVert from './line_pattern.vertex.glsl.g';
import lineSDFFrag from './line_sdf.fragment.glsl.g';
import lineSDFVert from './line_sdf.vertex.glsl.g';
import lineGradientSDFFrag from './line_gradient_sdf.fragment.glsl.g';
import lineGradientSDFVert from './line_gradient_sdf.vertex.glsl.g';
import rasterFrag from './raster.fragment.glsl.g';
import rasterVert from './raster.vertex.glsl.g';
import symbolIconFrag from './symbol_icon.fragment.glsl.g';
import symbolIconVert from './symbol_icon.vertex.glsl.g';
import symbolSDFFrag from './symbol_sdf.fragment.glsl.g';
import symbolSDFVert from './symbol_sdf.vertex.glsl.g';
import symbolTextAndIconFrag from './symbol_text_and_icon.fragment.glsl.g';
import symbolTextAndIconVert from './symbol_text_and_icon.vertex.glsl.g';
import terrainDepthFrag from './terrain_depth.fragment.glsl.g';
import terrainCoordsFrag from './terrain_coords.fragment.glsl.g';
import terrainFrag from './terrain.fragment.glsl.g';
import terrainVert from './terrain.vertex.glsl.g';
import terrainVertDepth from './terrain_depth.vertex.glsl.g';
import terrainVertCoords from './terrain_coords.vertex.glsl.g';
import projectionErrorMeasurementVert from './projection_error_measurement.vertex.glsl.g';
import projectionErrorMeasurementFrag from './projection_error_measurement.fragment.glsl.g';
import projectionMercatorVert from './_projection_mercator.vertex.glsl.g';
import projectionGlobeVert from './_projection_globe.vertex.glsl.g';
import atmosphereFrag from './atmosphere.fragment.glsl.g';
import atmosphereVert from './atmosphere.vertex.glsl.g';
import skyFrag from './sky.fragment.glsl.g';
import skyVert from './sky.vertex.glsl.g';

export type PreparedShader = {
    fragmentSource: string;
    vertexSource: string;
    staticAttributes: Array<string>;
    staticUniforms: Array<string>;
};

export const shaders = {
    prelude: prepare(preludeFrag, preludeVert),
    projectionMercator: prepare('', projectionMercatorVert),
    projectionGlobe: prepare('', projectionGlobeVert),
    background: prepare(backgroundFrag, backgroundVert),
    backgroundPattern: prepare(backgroundPatternFrag, backgroundPatternVert),
    circle: prepare(circleFrag, circleVert),
    clippingMask: prepare(clippingMaskFrag, clippingMaskVert),
    heatmap: prepare(heatmapFrag, heatmapVert),
    heatmapTexture: prepare(heatmapTextureFrag, heatmapTextureVert),
    collisionBox: prepare(collisionBoxFrag, collisionBoxVert),
    collisionCircle: prepare(collisionCircleFrag, collisionCircleVert),
    colorRelief: prepare(colorReliefFrag, colorReliefVert),
    debug: prepare(debugFrag, debugVert),
    depth: prepare(clippingMaskFrag, depthVert),
    fill: prepare(fillFrag, fillVert),
    fillOutline: prepare(fillOutlineFrag, fillOutlineVert),
    fillOutlinePattern: prepare(fillOutlinePatternFrag, fillOutlinePatternVert),
    fillPattern: prepare(fillPatternFrag, fillPatternVert),
    fillExtrusion: prepare(fillExtrusionFrag, fillExtrusionVert),
    fillExtrusionPattern: prepare(fillExtrusionPatternFrag, fillExtrusionPatternVert),
    hillshadePrepare: prepare(hillshadePrepareFrag, hillshadePrepareVert),
    hillshade: prepare(hillshadeFrag, hillshadeVert),
    line: prepare(lineFrag, lineVert),
    lineGradient: prepare(lineGradientFrag, lineGradientVert),
    linePattern: prepare(linePatternFrag, linePatternVert),
    lineSDF: prepare(lineSDFFrag, lineSDFVert),
    lineGradientSDF: prepare(lineGradientSDFFrag, lineGradientSDFVert),
    raster: prepare(rasterFrag, rasterVert),
    symbolIcon: prepare(symbolIconFrag, symbolIconVert),
    symbolSDF: prepare(symbolSDFFrag, symbolSDFVert),
    symbolTextAndIcon: prepare(symbolTextAndIconFrag, symbolTextAndIconVert),
    terrain: prepare(terrainFrag, terrainVert),
    terrainDepth: prepare(terrainDepthFrag, terrainVertDepth),
    terrainCoords: prepare(terrainCoordsFrag, terrainVertCoords),
    projectionErrorMeasurement: prepare(projectionErrorMeasurementFrag, projectionErrorMeasurementVert),
    atmosphere: prepare(atmosphereFrag, atmosphereVert),
    sky: prepare(skyFrag, skyVert),
};

/** Expand #pragmas to #ifdefs, extract attributes and uniforms */
function prepare(fragmentSource: string, vertexSource: string): PreparedShader {
    const re = /#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g;

    const vertexAttributes = vertexSource.match(/in ([\w]+) ([\w]+)/g);
    const fragmentUniforms = fragmentSource.match(/uniform ([\w]+) ([\w]+)([\s]*)([\w]*)/g);
    const vertexUniforms = vertexSource.match(/uniform ([\w]+) ([\w]+)([\s]*)([\w]*)/g);
    const shaderUniforms = vertexUniforms ? vertexUniforms.concat(fragmentUniforms) : fragmentUniforms;

    const fragmentPragmas = {};

    fragmentSource = fragmentSource.replace(re, (match, operation, precision, type, name) => {
        fragmentPragmas[name] = true;
        if (operation === 'define') {
            return `
#ifndef HAS_UNIFORM_u_${name}
in ${precision} ${type} ${name};
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
in ${precision} ${attrType} a_${name};
out ${precision} ${type} ${name};
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
in ${precision} ${attrType} a_${name};
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

    return {fragmentSource, vertexSource, staticAttributes: vertexAttributes, staticUniforms: shaderUniforms};
}

/** Transpile WebGL2 vertex shader source to WebGL1 */
export function transpileVertexShaderToWebGL1(source: string): string {
    return source
        .replace(/\bin\s/g, 'attribute ')
        .replace(/\bout\s/g, 'varying ')
        .replace(/texture\(/g, 'texture2D(');
}

/** Transpile WebGL2 fragment shader source to WebGL1 */
export function transpileFragmentShaderToWebGL1(source: string): string {
    return source
        .replace(/\bin\s/g, 'varying ')
        .replace('out highp vec4 fragColor;', '')
        .replace(/fragColor/g, 'gl_FragColor')
        .replace(/texture\(/g, 'texture2D(');
}
