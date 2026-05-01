import {fillExtrusionUniforms, fillExtrusionPatternUniforms} from './fill_extrusion_program';
import {fillPatternUniforms, fillOutlineUniforms, fillOutlinePatternUniforms, fillUniforms} from './fill_program';
import {circleUniforms} from './circle_program';
import {collisionUniforms, collisionCircleUniforms} from './collision_program';
import {debugUniforms} from './debug_program';
import {heatmapUniforms, heatmapTextureUniforms} from './heatmap_program';
import {hillshadeUniforms, hillshadePrepareUniforms} from './hillshade_program';
import {colorReliefUniforms} from './color_relief_program';
import {lineUniforms, lineGradientUniforms, linePatternUniforms, lineSDFUniforms, lineGradientSDFUniforms, lineTextureUniforms} from './line_program';
import {rasterUniforms} from './raster_program';
import {symbolIconUniforms, symbolSDFUniforms, symbolTextAndIconUniforms} from './symbol_program';
import {backgroundUniforms, backgroundPatternUniforms} from './background_program';
import {terrainUniforms, terrainDepthUniforms, terrainCoordsUniforms} from './terrain_program';
import {projectionErrorMeasurementUniforms} from './projection_error_measurement_program';
import {atmosphereUniforms} from './atmosphere_program';
import {skyUniforms} from './sky_program';

const emptyUniforms = (_: any, __: any): any => {};

export const programUniforms: {
    fillExtrusion: (context: Context, locations: UniformLocations) => FillExtrusionUniformsType;
    fillExtrusionPattern: (context: Context, locations: UniformLocations) => FillExtrusionPatternUniformsType;
    fill: (context: Context, locations: UniformLocations) => FillUniformsType;
    fillPattern: (context: Context, locations: UniformLocations) => FillPatternUniformsType;
    fillOutline: (context: Context, locations: UniformLocations) => FillOutlineUniformsType;
    fillOutlinePattern: (context: Context, locations: UniformLocations) => FillOutlinePatternUniformsType;
    circle: (context: Context, locations: UniformLocations) => CircleUniformsType;
    collisionBox: (context: Context, locations: UniformLocations) => CollisionUniformsType;
    collisionCircle: (context: Context, locations: UniformLocations) => CollisionCircleUniformsType;
    debug: (context: Context, locations: UniformLocations) => DebugUniformsType;
    depth: (_: any, __: any) => any;
    clippingMask: (_: any, __: any) => any;
    heatmap: (context: Context, locations: UniformLocations) => HeatmapUniformsType;
    heatmapTexture: (context: Context, locations: UniformLocations) => HeatmapTextureUniformsType;
    hillshade: (context: Context, locations: UniformLocations) => HillshadeUniformsType;
    hillshadePrepare: (context: Context, locations: UniformLocations) => HillshadePrepareUniformsType;
    colorRelief: (context: Context, locations: UniformLocations) => ColorReliefUniformsType;
    line: (context: Context, locations: UniformLocations) => LineUniformsType;
    lineGradient: (context: Context, locations: UniformLocations) => LineGradientUniformsType;
    linePattern: (context: Context, locations: UniformLocations) => LinePatternUniformsType;
    lineSDF: (context: Context, locations: UniformLocations) => LineSDFUniformsType;
    lineGradientSDF: (context: Context, locations: UniformLocations) => LineGradientSDFUniformsType;
    raster: (context: Context, locations: UniformLocations) => RasterUniformsType;
    symbolIcon: (context: Context, locations: UniformLocations) => SymbolIconUniformsType;
    symbolSDF: (context: Context, locations: UniformLocations) => SymbolSDFUniformsType;
    symbolTextAndIcon: (context: Context, locations: UniformLocations) => symbolTextAndIconUniformsType;
    background: (context: Context, locations: UniformLocations) => BackgroundUniformsType;
    backgroundPattern: (context: Context, locations: UniformLocations) => BackgroundPatternUniformsType;
    terrain: (context: Context, locations: UniformLocations) => TerrainUniformsType;
    terrainDepth: (context: Context, locations: UniformLocations) => TerrainDepthUniformsType;
    terrainCoords: (context: Context, locations: UniformLocations) => TerrainCoordsUniformsType;
    projectionErrorMeasurement: (context: Context, locations: UniformLocations) => ProjectionErrorMeasurementUniformsType;
    atmosphere: (context: Context, locations: UniformLocations) => atmosphereUniformsType;
    sky: (context: Context, locations: UniformLocations) => SkyUniformsType;
} = {
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
