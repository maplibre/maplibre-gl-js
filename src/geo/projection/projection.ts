import type {Tile} from '../../source/tile';
import {pixelsToTileUnits} from '../../source/pixels_to_tile_units';
import type {PointProjection} from '../../symbol/projection';

/**
 * A greatly reduced version of the `Projection` interface from the globe branch,
 * used to port symbol bugfixes over to the main branch. Will be replaced with
 * the proper interface once globe is merged.
 */
export type Projection = {
    useSpecialProjectionForSymbols: boolean;
    isOccluded(_x, _y, _t): boolean;
    projectTileCoordinates(_x, _y, _t, _ele): PointProjection;
    getPitchedTextCorrection(_transform, _anchor, _tile): number;
    translatePosition(transform: { angle: number; zoom: number }, tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport'): [number, number];
    getCircleRadiusCorrection(tr: any): number;
};

export function createProjection(): Projection {
    return {
        isOccluded(_x: any, _y: any, _t: any) {
            return false;
        },
        getPitchedTextCorrection(_transform: any, _anchor: any, _tile: any) {
            return 1.0;
        },
        get useSpecialProjectionForSymbols() { return false; },
        projectTileCoordinates(_x, _y, _t, _ele) {
            // This function should only be used when useSpecialProjectionForSymbols is set to true.
            throw new Error('Not implemented.');
        },
        translatePosition(transform, tile, translate, translateAnchor) {
            return translatePosition(transform, tile, translate, translateAnchor);
        },
        getCircleRadiusCorrection(_: any) {
            return 1.0;
        }
    };
}

/**
 * Returns a translation in tile units that correctly incorporates the view angle and the *-translate and *-translate-anchor properties.
 * @param inViewportPixelUnitsUnits - True when the units accepted by the matrix are in viewport pixels instead of tile units.
 *
 * Temporarily imported from globe branch.
 */
function translatePosition(
    transform: { angle: number; zoom: number },
    tile: Tile,
    translate: [number, number],
    translateAnchor: 'map' | 'viewport',
    inViewportPixelUnitsUnits: boolean = false
): [number, number] {
    if (!translate[0] && !translate[1]) return [0, 0];

    const angle = inViewportPixelUnitsUnits ?
        (translateAnchor === 'map' ? transform.angle : 0) :
        (translateAnchor === 'viewport' ? -transform.angle : 0);

    if (angle) {
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        translate = [
            translate[0] * cosA - translate[1] * sinA,
            translate[0] * sinA + translate[1] * cosA
        ];
    }

    return [
        inViewportPixelUnitsUnits ? translate[0] : pixelsToTileUnits(tile, translate[0], transform.zoom),
        inViewportPixelUnitsUnits ? translate[1] : pixelsToTileUnits(tile, translate[1], transform.zoom)];
}
