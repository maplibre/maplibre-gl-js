import {drawSymbols} from './draw_symbol';
import {drawCircles} from './draw_circle';
import {drawHeatmap} from './draw_heatmap';
import {drawLine} from './draw_line';
import {drawFill} from './draw_fill';
import {drawFillExtrusion} from './draw_fill_extrusion';
import {drawHillshade} from './draw_hillshade';
import {drawColorRelief} from './draw_color_relief';
import {drawRaster} from './draw_raster';
import {drawBackground} from './draw_background';
import {drawDebug, drawDebugPadding, selectDebugSource} from './draw_debug';
import {drawCustom} from './draw_custom';
import {drawDepth, drawCoords} from './draw_terrain';
import {drawSky, drawAtmosphere} from './draw_sky';

export {drawSymbols, drawCircles, drawHeatmap, drawLine, drawFill, drawFillExtrusion,
    drawHillshade, drawColorRelief, drawRaster, drawBackground,
    drawDebug, drawDebugPadding, selectDebugSource, drawCustom,
    drawDepth, drawCoords, drawSky, drawAtmosphere};

export type DrawFunctions = {
    symbol: typeof drawSymbols;
    circle: typeof drawCircles;
    heatmap: typeof drawHeatmap;
    line: typeof drawLine;
    fill: typeof drawFill;
    fillExtrusion: typeof drawFillExtrusion;
    hillshade: typeof drawHillshade;
    colorRelief: typeof drawColorRelief;
    raster: typeof drawRaster;
    background: typeof drawBackground;
    sky: typeof drawSky;
    atmosphere: typeof drawAtmosphere;
    custom: typeof drawCustom;
    debug: typeof drawDebug;
    debugPadding: typeof drawDebugPadding;
    terrainDepth: typeof drawDepth;
    terrainCoords: typeof drawCoords;
};

export const webglDrawFunctions: DrawFunctions = {
    symbol: drawSymbols,
    circle: drawCircles,
    heatmap: drawHeatmap,
    line: drawLine,
    fill: drawFill,
    fillExtrusion: drawFillExtrusion,
    hillshade: drawHillshade,
    colorRelief: drawColorRelief,
    raster: drawRaster,
    background: drawBackground,
    sky: drawSky,
    atmosphere: drawAtmosphere,
    custom: drawCustom,
    debug: drawDebug,
    debugPadding: drawDebugPadding,
    terrainDepth: drawDepth,
    terrainCoords: drawCoords,
};
