import {fillExtrusionUniforms, fillExtrusionPatternUniforms} from './fill_extrusion_program.ts';
import {fillUniforms, fillPatternUniforms, fillOutlineUniforms, fillOutlinePatternUniforms} from './fill_program.ts';
import {circleUniforms} from './circle_program.ts';
import {collisionUniforms, collisionCircleUniforms} from './collision_program.ts';
import {debugUniforms} from './debug_program.ts';
import {clippingMaskUniforms} from './clipping_mask_program.ts';
import {heatmapUniforms, heatmapTextureUniforms} from './heatmap_program.ts';
import {hillshadeUniforms, hillshadePrepareUniforms} from './hillshade_program.ts';
import {lineUniforms, lineGradientUniforms, linePatternUniforms, lineSDFUniforms} from './line_program.ts';
import {rasterUniforms} from './raster_program.ts';
import {symbolIconUniforms, symbolSDFUniforms, symbolTextAndIconUniforms} from './symbol_program.ts';
import {backgroundUniforms, backgroundPatternUniforms} from './background_program.ts';
import {terrainUniforms, terrainDepthUniforms, terrainCoordsUniforms} from './terrain_program.ts';

export const programUniforms = {
    fillExtrusion: fillExtrusionUniforms,
    fillExtrusionPattern: fillExtrusionPatternUniforms,
    fill: fillUniforms,
    fillPattern: fillPatternUniforms,
    fillOutline: fillOutlineUniforms,
    fillOutlinePattern: fillOutlinePatternUniforms,
    circle: circleUniforms,
    collisionBox: collisionUniforms,
    collisionCircle: collisionCircleUniforms,
    debug: debugUniforms,
    clippingMask: clippingMaskUniforms,
    heatmap: heatmapUniforms,
    heatmapTexture: heatmapTextureUniforms,
    hillshade: hillshadeUniforms,
    hillshadePrepare: hillshadePrepareUniforms,
    line: lineUniforms,
    lineGradient: lineGradientUniforms,
    linePattern: linePatternUniforms,
    lineSDF: lineSDFUniforms,
    raster: rasterUniforms,
    symbolIcon: symbolIconUniforms,
    symbolSDF: symbolSDFUniforms,
    symbolTextAndIcon: symbolTextAndIconUniforms,
    background: backgroundUniforms,
    backgroundPattern: backgroundPatternUniforms,
    terrain: terrainUniforms,
    terrainDepth: terrainDepthUniforms,
    terrainCoords: terrainCoordsUniforms
};
