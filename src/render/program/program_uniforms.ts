import {fillExtrusionUniforms, fillExtrusionPatternUniforms} from './fill_extrusion_program';
import {fillPatternUniforms, fillOutlineUniforms, fillOutlinePatternUniforms, fillUniforms} from './fill_program';
import {circleUniforms} from './circle_program';
import {collisionUniforms, collisionCircleUniforms} from './collision_program';
import {debugUniforms} from './debug_program';
import {heatmapUniforms, heatmapTextureUniforms} from './heatmap_program';
import {hillshadeUniforms, hillshadePrepareUniforms} from './hillshade_program';
import {lineUniforms, lineGradientUniforms, linePatternUniforms, lineSDFUniforms} from './line_program';
import {rasterUniforms} from './raster_program';
import {symbolIconUniforms, symbolSDFUniforms, symbolTextAndIconUniforms} from './symbol_program';
import {backgroundUniforms, backgroundPatternUniforms} from './background_program';
import {terrainUniforms, terrainDepthUniforms, terrainCoordsUniforms} from './terrain_program';
import {projectionErrorMeasurementUniforms} from './projection_error_measurement_program';
import {atmosphereUniforms} from './atmosphere_program';
import {skyUniforms} from './sky_program';

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
    terrainCoords: terrainCoordsUniforms,
    projectionErrorMeasurement: projectionErrorMeasurementUniforms,
    atmosphere: atmosphereUniforms,
    sky: skyUniforms
};
