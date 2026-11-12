import {MercatorCoveringTilesDetailsProvider} from './mercator_covering_tiles_details_provider.ts';
import {GlobeCoveringTilesDetailsProvider} from './globe_covering_tiles_details_provider.ts';
import {renderedProjection} from './camera_projection.ts';

import type {CameraProjection} from './camera_projection.ts';
import type {CoveringTilesDetailsProvider} from './covering_tiles_details_provider.ts';

/** The mercator provider, which holds no state and so serves every map. */
let mercatorProvider: MercatorCoveringTilesDetailsProvider | null = null;

/**
 * The globe provider of each map, by the vertical perspective projection the map's globe is drawn with, so that each map
 * keeps its own bounding volume cache, see {@link CoveringTilesDetailsProvider.prepareNextFrame}.
 */
const globeProviders = new WeakMap<CameraProjection, GlobeCoveringTilesDetailsProvider>();

/**
 * @internal
 * Returns the covering tiles details of the projection a camera is drawn with: mercator, or the globe while it renders
 * as a globe.
 */
export function getCoveringTilesDetailsProvider(projection: CameraProjection): CoveringTilesDetailsProvider {
    const rendered = renderedProjection(projection);
    if (rendered.kind === 'mercator') {
        mercatorProvider ??= new MercatorCoveringTilesDetailsProvider();
        return mercatorProvider;
    }
    let provider = globeProviders.get(rendered);
    if (!provider) globeProviders.set(rendered, provider = new GlobeCoveringTilesDetailsProvider());
    return provider;
}
