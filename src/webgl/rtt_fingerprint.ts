import {type OverscaledTileID} from '../tile/tile_id.ts';

/**
 * What a render-to-texture tile's textures differ in from the state this frame would render them from,
 * least to most severe: `zoom` (the same layers and source tiles, evaluated at another zoom), `sourceTiles`
 * (other source tiles under the terrain tile), `visibleLayers` (a layer entered or left its zoom range) and
 * `revision` (the source data changed, or the textures were rendered without this source).
 *
 * @internal
 */
export const RTT_DIFFERENCES = ['none', 'zoom', 'sourceTiles', 'visibleLayers', 'revision'] as const;
export type RTTDifference = typeof RTT_DIFFERENCES[number];

/**
 * Immutable value describing the state a render-to-texture tile's textures were rendered from: the source
 * tiles drawn into them, the source data revision, the map zoom (zoom-dependent style properties are
 * evaluated then) and the ids of the layers visible at that zoom.
 *
 * @internal
 */
export class RTTFingerprint {
    private readonly _tileKeys: string;
    private readonly _revision: number;
    private readonly _zoom: number;
    private readonly _visibleLayerIds: string;

    constructor(coords: OverscaledTileID[], revision: number, zoom: number, visibleLayerIds: string) {
        this._tileKeys = coords.map(c => c.key).sort().join();
        this._revision = revision;
        this._zoom = zoom;
        this._visibleLayerIds = visibleLayerIds;
    }

    /**
     * The most severe difference between this fingerprint and the one the textures were rendered from,
     * `none` when they match. A missing fingerprint counts as a revision difference.
     */
    difference(other: RTTFingerprint | undefined): RTTDifference {
        if (this._revision !== other?._revision) return 'revision';
        if (this._visibleLayerIds !== other._visibleLayerIds) return 'visibleLayers';
        if (this._tileKeys !== other._tileKeys) return 'sourceTiles';
        return this._zoom === other._zoom ? 'none' : 'zoom';
    }
}
