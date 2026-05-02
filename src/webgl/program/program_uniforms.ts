import {fillExtrusionUniforms, fillExtrusionPatternUniforms} from './fill_extrusion_program.ts';
import {fillPatternUniforms, fillOutlineUniforms, fillOutlinePatternUniforms, fillUniforms} from './fill_program.ts';
import {circleUniforms} from './circle_program.ts';
import {collisionUniforms, collisionCircleUniforms} from './collision_program.ts';
import {debugUniforms} from './debug_program.ts';
import {heatmapUniforms, heatmapTextureUniforms} from './heatmap_program.ts';
import {hillshadeUniforms, hillshadePrepareUniforms} from './hillshade_program.ts';
import {colorReliefUniforms} from './color_relief_program.ts';
import {lineUniforms, lineGradientUniforms, linePatternUniforms, lineSDFUniforms, lineGradientSDFUniforms, lineTextureUniforms} from './line_program.ts';
import {rasterUniforms} from './raster_program.ts';
import {symbolIconUniforms, symbolSDFUniforms, symbolTextAndIconUniforms} from './symbol_program.ts';
import {backgroundUniforms, backgroundPatternUniforms} from './background_program.ts';
import {terrainUniforms, terrainDepthUniforms, terrainCoordsUniforms} from './terrain_program.ts';
import {projectionErrorMeasurementUniforms} from './projection_error_measurement_program.ts';
import {atmosphereUniforms} from './atmosphere_program.ts';
import {skyUniforms} from './sky_program.ts';

const emptyUniforms = (_: any, __: any): any => {};

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
    depth: emptyUniforms,
    clippingMask: emptyUniforms,
    heatmap: heatmapUniforms,
    heatmapTexture: heatmapTextureUniforms,
    hillshade: hillshadeUniforms,
    hillshadePrepare: hillshadePrepareUniforms,
    colorRelief: colorReliefUniforms,
    line: lineUniforms,
    lineGradient: lineGradientUniforms,
    linePattern: linePatternUniforms,
    lineSDF: lineSDFUniforms,
    lineGradientSDF: lineGradientSDFUniforms,
    lineTexture: lineTextureUniforms,
    raster: rasterUniforms,
    symbolIcon: symbolIconUniforms,
    symbolSDF: symbolSDFUniforms,
    symbolTextAndIcon: symbolTextAndIconUniforms,
    background: backgroundUniforms,
    backgroundPattern: backgroundPatternUniforms,
    terrain: terrainUniforms,
    terrainDepth: terrainDepthUniforms,
    terrainCoords: terrainCoordsUniforms,
    projectionErrorMeasurement: projectionErrorMeasurementUniforms,
    atmosphere: atmosphereUniforms,
    sky: skyUniforms
};
