import {drawSymbols} from './draw_symbol.ts';
import {drawCircles} from './draw_circle.ts';
import {drawHeatmap} from './draw_heatmap.ts';
import {drawLine} from './draw_line.ts';
import {drawFill} from './draw_fill.ts';
import {drawFillExtrusion} from './draw_fill_extrusion.ts';
import {drawHillshade} from './draw_hillshade.ts';
import {drawColorRelief} from './draw_color_relief.ts';
import {drawRaster} from './draw_raster.ts';
import {drawBackground} from './draw_background.ts';
import {drawDebug, drawDebugPadding, selectDebugSource} from './draw_debug.ts';
import {drawCustom} from './draw_custom.ts';
import {drawDepth, drawCoords} from './draw_terrain.ts';
import {drawSky, drawAtmosphere} from './draw_sky.ts';

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
