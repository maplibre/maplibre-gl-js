// Disable Flow annotations here because Flow doesn't support importing GLSL files

import preludeFrag from './glsl/_prelude.fragment.glsl.g.ts';
import preludeVert from './glsl/_prelude.vertex.glsl.g.ts';
import backgroundFrag from './glsl/background.fragment.glsl.g.ts';
import backgroundVert from './glsl/background.vertex.glsl.g.ts';
import backgroundPatternFrag from './glsl/background_pattern.fragment.glsl.g.ts';
import backgroundPatternVert from './glsl/background_pattern.vertex.glsl.g.ts';
import circleFrag from './glsl/circle.fragment.glsl.g.ts';
import circleVert from './glsl/circle.vertex.glsl.g.ts';
import clippingMaskFrag from './glsl/clipping_mask.fragment.glsl.g.ts';
import clippingMaskVert from './glsl/clipping_mask.vertex.glsl.g.ts';
import heatmapFrag from './glsl/heatmap.fragment.glsl.g.ts';
import heatmapVert from './glsl/heatmap.vertex.glsl.g.ts';
import heatmapTextureFrag from './glsl/heatmap_texture.fragment.glsl.g.ts';
import heatmapTextureVert from './glsl/heatmap_texture.vertex.glsl.g.ts';
import collisionBoxFrag from './glsl/collision_box.fragment.glsl.g.ts';
import collisionBoxVert from './glsl/collision_box.vertex.glsl.g.ts';
import collisionCircleFrag from './glsl/collision_circle.fragment.glsl.g.ts';
import collisionCircleVert from './glsl/collision_circle.vertex.glsl.g.ts';
import colorReliefFrag from './glsl/color_relief.fragment.glsl.g.ts';
import colorReliefVert from './glsl/color_relief.vertex.glsl.g.ts';
import debugFrag from './glsl/debug.fragment.glsl.g.ts';
import debugVert from './glsl/debug.vertex.glsl.g.ts';
import depthVert from './glsl/depth.vertex.glsl.g.ts';
import fillFrag from './glsl/fill.fragment.glsl.g.ts';
import fillVert from './glsl/fill.vertex.glsl.g.ts';
import fillOutlineFrag from './glsl/fill_outline.fragment.glsl.g.ts';
import fillOutlineVert from './glsl/fill_outline.vertex.glsl.g.ts';
import fillOutlinePatternFrag from './glsl/fill_outline_pattern.fragment.glsl.g.ts';
import fillOutlinePatternVert from './glsl/fill_outline_pattern.vertex.glsl.g.ts';
import fillPatternFrag from './glsl/fill_pattern.fragment.glsl.g.ts';
import fillPatternVert from './glsl/fill_pattern.vertex.glsl.g.ts';
import fillExtrusionFrag from './glsl/fill_extrusion.fragment.glsl.g.ts';
import fillExtrusionVert from './glsl/fill_extrusion.vertex.glsl.g.ts';
import fillExtrusionPatternFrag from './glsl/fill_extrusion_pattern.fragment.glsl.g.ts';
import fillExtrusionPatternVert from './glsl/fill_extrusion_pattern.vertex.glsl.g.ts';
import hillshadePrepareFrag from './glsl/hillshade_prepare.fragment.glsl.g.ts';
import hillshadePrepareVert from './glsl/hillshade_prepare.vertex.glsl.g.ts';
import hillshadeFrag from './glsl/hillshade.fragment.glsl.g.ts';
import hillshadeVert from './glsl/hillshade.vertex.glsl.g.ts';
import lineFrag from './glsl/line.fragment.glsl.g.ts';
import lineVert from './glsl/line.vertex.glsl.g.ts';
import lineGradientFrag from './glsl/line_gradient.fragment.glsl.g.ts';
import lineGradientVert from './glsl/line_gradient.vertex.glsl.g.ts';
import linePatternFrag from './glsl/line_pattern.fragment.glsl.g.ts';
import linePatternVert from './glsl/line_pattern.vertex.glsl.g.ts';
import lineSDFFrag from './glsl/line_sdf.fragment.glsl.g.ts';
import lineSDFVert from './glsl/line_sdf.vertex.glsl.g.ts';
import lineGradientSDFFrag from './glsl/line_gradient_sdf.fragment.glsl.g.ts';
import lineGradientSDFVert from './glsl/line_gradient_sdf.vertex.glsl.g.ts';
import lineTextureFrag from './glsl/line_texture.fragment.glsl.g.ts';
import lineTextureVert from './glsl/line_texture.vertex.glsl.g.ts';
import rasterFrag from './glsl/raster.fragment.glsl.g.ts';
import rasterVert from './glsl/raster.vertex.glsl.g.ts';
import symbolIconFrag from './glsl/symbol_icon.fragment.glsl.g.ts';
import symbolIconVert from './glsl/symbol_icon.vertex.glsl.g.ts';
import symbolSDFFrag from './glsl/symbol_sdf.fragment.glsl.g.ts';
import symbolSDFVert from './glsl/symbol_sdf.vertex.glsl.g.ts';
import symbolTextAndIconFrag from './glsl/symbol_text_and_icon.fragment.glsl.g.ts';
import symbolTextAndIconVert from './glsl/symbol_text_and_icon.vertex.glsl.g.ts';
import terrainDepthFrag from './glsl/terrain_depth.fragment.glsl.g.ts';
import terrainCoordsFrag from './glsl/terrain_coords.fragment.glsl.g.ts';
import terrainFrag from './glsl/terrain.fragment.glsl.g.ts';
import terrainVert from './glsl/terrain.vertex.glsl.g.ts';
import terrainVertDepth from './glsl/terrain_depth.vertex.glsl.g.ts';
import terrainVertCoords from './glsl/terrain_coords.vertex.glsl.g.ts';
import projectionErrorMeasurementVert from './glsl/projection_error_measurement.vertex.glsl.g.ts';
import projectionErrorMeasurementFrag from './glsl/projection_error_measurement.fragment.glsl.g.ts';
import projectionMercatorVert from './glsl/_projection_mercator.vertex.glsl.g.ts';
import projectionGlobeVert from './glsl/_projection_globe.vertex.glsl.g.ts';
import atmosphereFrag from './glsl/atmosphere.fragment.glsl.g.ts';
import atmosphereVert from './glsl/atmosphere.vertex.glsl.g.ts';
import skyFrag from './glsl/sky.fragment.glsl.g.ts';
import skyVert from './glsl/sky.vertex.glsl.g.ts';

export type PreparedShader = {
    fragmentSource: string;
    vertexSource: string;
    staticAttributes: string[];
    staticUniforms: string[];
};

export const shaders: {
    prelude: PreparedShader;
    projectionMercator: PreparedShader;
    projectionGlobe: PreparedShader;
    background: PreparedShader;
    backgroundPattern: PreparedShader;
    circle: PreparedShader;
    clippingMask: PreparedShader;
    heatmap: PreparedShader;
    heatmapTexture: PreparedShader;
    collisionBox: PreparedShader;
    collisionCircle: PreparedShader;
    colorRelief: PreparedShader;
    debug: PreparedShader;
    depth: PreparedShader;
    fill: PreparedShader;
    fillOutline: PreparedShader;
    fillOutlinePattern: PreparedShader;
    fillPattern: PreparedShader;
    fillExtrusion: PreparedShader;
    fillExtrusionPattern: PreparedShader;
    hillshadePrepare: PreparedShader;
    hillshade: PreparedShader;
    line: PreparedShader;
    lineGradient: PreparedShader;
    linePattern: PreparedShader;
    lineSDF: PreparedShader;
    lineGradientSDF: PreparedShader;
    lineTexture: PreparedShader;
    raster: PreparedShader;
    symbolIcon: PreparedShader;
    symbolSDF: PreparedShader;
    symbolTextAndIcon: PreparedShader;
    terrain: PreparedShader;
    terrainDepth: PreparedShader;
    terrainCoords: PreparedShader;
    projectionErrorMeasurement: PreparedShader;
    atmosphere: PreparedShader;
    sky: PreparedShader;
} = {
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
    lineTexture: prepare(lineTextureFrag, lineTextureVert),
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

