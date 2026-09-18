import type {CrossFaded} from '../style/properties.ts';
import type {ResolvedImage} from '@maplibre/maplibre-gl-style-spec';
import type {Tile} from '../tile/tile.ts';
import type {ProgramConfiguration} from '../data/program_configuration.ts';
import type {FillExtrusionStyleLayer} from '../style/style_layer/fill_extrusion_style_layer.ts';
import type {FillStyleLayer} from '../style/style_layer/fill_style_layer.ts';
import type {LineStyleLayer} from '../style/style_layer/line_style_layer.ts';

/**
 * A simple helper shared by draw_fill, draw_fill_extrusions, and draw_line to find the correct pattern positions AND update program.
 * For transitionable properties, especially 'fill-pattern', 'fill-extrusion-pattern', and 'line-pattern', while rendering certain frames
 * tile.imageAtlas has been updated by worker to hold the new pattern only, but rendering code is still looking for the previous image.
 * The mismatch was causing setConstantPatternPositions method not being called and pixelRatio was always the
 * default of 1, instead of actual values set by original map.addImage.
 *
 * @param programConfiguration - to be used to set pattern position and device pixel ratio.
 * @param propertyName - 'fill-pattern', 'fill-extrusion-pattern', or 'line-pattern' property key
 * @param constantPattern - the corresponding property value
 * @param tile - current tile being drawn
 * @param layer - current layer being rendered
 */
export function updatePatternPositionsInProgram(
    programConfiguration: ProgramConfiguration,
    propertyName: 'fill-pattern' | 'fill-extrusion-pattern' | 'line-pattern',
    constantPattern: CrossFaded<ResolvedImage>,
    tile: Tile,
    layer: FillStyleLayer | FillExtrusionStyleLayer | LineStyleLayer): void {

    if (!constantPattern || !tile?.imageAtlas) {
        return;
    }

    const patternPositions = tile.imageAtlas.patternPositions;
    let posTo = patternPositions[constantPattern.to.toString()];
    let posFrom = patternPositions[constantPattern.from.toString()];

    // https://github.com/maplibre/maplibre-gl-js/issues/3377
    if (!posTo && posFrom) posTo = posFrom;
    if (!posFrom && posTo) posFrom = posTo;

    // try again in case patternPositions has been updated by worker
    if (!posTo || !posFrom) {
        const transitioned = layer.getPaintProperty(propertyName) as string;
        posTo = patternPositions[transitioned];
        posFrom = patternPositions[transitioned];
    }

    if (posTo && posFrom) {
        programConfiguration.setConstantPatternPositions(posTo, posFrom);
    }
}
