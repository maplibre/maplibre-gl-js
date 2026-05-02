import {fillExtrusionUniforms, fillExtrusionPatternUniforms, type FillExtrusionUniformsType, type FillExtrusionPatternUniformsType} from './fill_extrusion_program.ts';
import {fillPatternUniforms, fillOutlineUniforms, fillOutlinePatternUniforms, fillUniforms, type FillUniformsType, type FillPatternUniformsType, type FillOutlineUniformsType, type FillOutlinePatternUniformsType} from './fill_program.ts';
import {circleUniforms, type CircleUniformsType} from './circle_program.ts';
import {collisionUniforms, collisionCircleUniforms, type CollisionUniformsType, type CollisionCircleUniformsType} from './collision_program.ts';
import {debugUniforms, type DebugUniformsType} from './debug_program.ts';
import {heatmapUniforms, heatmapTextureUniforms, type HeatmapUniformsType, type HeatmapTextureUniformsType} from './heatmap_program.ts';
import {hillshadeUniforms, hillshadePrepareUniforms, type HillshadeUniformsType, type HillshadePrepareUniformsType} from './hillshade_program.ts';
import {colorReliefUniforms, type ColorReliefUniformsType} from './color_relief_program.ts';
import {lineUniforms, lineGradientUniforms, linePatternUniforms, lineSDFUniforms, lineGradientSDFUniforms, lineTextureUniforms, type LineUniformsType, type LineGradientUniformsType, type LinePatternUniformsType, type LineSDFUniformsType, type LineGradientSDFUniformsType, type LineTextureUniformsType} from './line_program.ts';
import {rasterUniforms, type RasterUniformsType} from './raster_program.ts';
import {symbolIconUniforms, symbolSDFUniforms, symbolTextAndIconUniforms, type SymbolIconUniformsType, type SymbolSDFUniformsType, type symbolTextAndIconUniformsType} from './symbol_program.ts';
import {backgroundUniforms, backgroundPatternUniforms, type BackgroundUniformsType, type BackgroundPatternUniformsType} from './background_program.ts';
import {terrainUniforms, terrainDepthUniforms, terrainCoordsUniforms, type TerrainUniformsType, type TerrainDepthUniformsType, type TerrainCoordsUniformsType} from './terrain_program.ts';
import {projectionErrorMeasurementUniforms, type ProjectionErrorMeasurementUniformsType} from './projection_error_measurement_program.ts';
import {atmosphereUniforms, type atmosphereUniformsType} from './atmosphere_program.ts';
import {skyUniforms, type SkyUniformsType} from './sky_program.ts';
import type {Context} from '../context.ts';
import type {UniformLocations} from '../uniform_binding.ts';

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
    lineTexture: (context: Context, locations: UniformLocations) => LineTextureUniformsType;
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
