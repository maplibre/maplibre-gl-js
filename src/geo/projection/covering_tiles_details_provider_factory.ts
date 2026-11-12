import {MercatorCoveringTilesDetailsProvider} from './mercator_covering_tiles_details_provider.ts';
import {GlobeCoveringTilesDetailsProvider} from './globe_covering_tiles_details_provider.ts';
import {renderedProjectedCamera} from './camera_math.ts';

import type {CoveringTilesDetailsProvider} from './covering_tiles_details_provider.ts';
import type {ProjectedCamera} from '../projected_camera.ts';

/** The mercator provider. Neither provider holds anything of a map's, so one of each serves every map. */
let mercatorProvider: MercatorCoveringTilesDetailsProvider | null = null;

/** The globe provider, see {@link mercatorProvider}. */
let globeProvider: GlobeCoveringTilesDetailsProvider | null = null;

/**
 * @internal
 * Returns the covering tiles details of the projection a camera is drawn with: mercator, or the globe while it renders
 * as a globe.
 */
export function getCoveringTilesDetailsProvider(projectedCamera: ProjectedCamera): CoveringTilesDetailsProvider {
    if (renderedProjectedCamera(projectedCamera).projection === 'mercator') {
        mercatorProvider ??= new MercatorCoveringTilesDetailsProvider();
        return mercatorProvider;
    }
    globeProvider ??= new GlobeCoveringTilesDetailsProvider();
    return globeProvider;
}
