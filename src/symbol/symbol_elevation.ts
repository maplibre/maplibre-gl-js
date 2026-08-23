import type {GetElevation} from '../geo/transform_interface.ts';

/**
 * Resolves the elevation of a symbol at a tile coordinate, combining the terrain elevation with the
 * symbol's `symbol-height-offset`. `symbol-height-anchor` selects the datum the offset is measured
 * from: the terrain surface below the symbol (`ground`) or the zero elevation datum (`absolute`),
 * in which case the terrain below the symbol is ignored.
 *
 * Call this where the elevation is needed, so that `getElevation` keeps returning the plain terrain
 * elevation and never has to be substituted with a wrapper.
 *
 * @param getElevation - the terrain elevation function, absent when the map has no terrain
 * @param x - the tile x coordinate to evaluate the elevation at
 * @param y - the tile y coordinate to evaluate the elevation at
 * @param heightOffset - the evaluated `symbol-height-offset` of the symbol, in meters
 * @param heightAnchorGround - whether `symbol-height-anchor` is `ground`
 * @returns the elevation in meters, or undefined when the symbol sits at the zero elevation datum,
 * which lets the projection take its fast path that ignores the z coordinate
 */
export function getSymbolElevation(getElevation: GetElevation | undefined, x: number, y: number, heightOffset: number, heightAnchorGround: boolean): number | undefined {
    if (!heightAnchorGround) {
        return heightOffset;
    }
    if (!getElevation) {
        return heightOffset !== 0 ? heightOffset : undefined;
    }
    return getElevation(x, y) + heightOffset;
}
