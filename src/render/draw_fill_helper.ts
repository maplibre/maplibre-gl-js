import type {CrossFaded} from '../style/properties';
import type ResolvedImage from '../style-spec/expression/types/resolved_image';
import type Tile from '../source/tile';
import type ProgramConfiguration from '../data/program_configuration';
import type FillExtrusionStyleLayer from '../style/style_layer/fill_extrusion_style_layer';
import type FillStyleLayer from '../style/style_layer/fill_style_layer';

export default findPatternPositions;

/**
 * Simple helper function shared by draw_fill and draw_fill_extrusions to correctly find images from tile.imageAtlas.
 * For transtionable properties, especially 'fill-pattern' and 'fill-extrusion-pattern', at certain frames
 * tile.imageAtlas has been updated by worker to holds the new pattern only, but code here is still looking for previous images,
 * causing a few corrupted frames in which setConstantPatternPositions method is not called and pixelRatio is always the
 * default of 1, instead of actual values set by original map.addImage
 *
 * @param propertyName - 'fill-pattern' or 'fill-extrusion-pattern' property key
 * @param constantPattern - either 'fill-pattern' or 'fill-extrusion-pattern' property value
 * @param tile - current tile being drawn
 * @param layer - current layer being rendered
 * @param programConfiguration - to be used to set patttern poistion and device pixel ratio.
 */
function findPatternPositions(
    propertyName: 'fill-pattern' | 'fill-extrusion-pattern',
    constantPattern: CrossFaded<ResolvedImage>,
    tile: Tile,
    layer: FillStyleLayer | FillExtrusionStyleLayer,
    programConfiguration: ProgramConfiguration): void {

    if (constantPattern && tile.imageAtlas) {
        const patternPositions = tile.imageAtlas.patternPositions;
        let posTo = patternPositions[constantPattern.to.toString()];
        let posFrom = patternPositions[constantPattern.from.toString()];

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
}
