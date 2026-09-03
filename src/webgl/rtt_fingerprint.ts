import {type OverscaledTileID} from '../tile/tile_id.ts';

/**
 * Immutable value describing the state a render-to-texture tile's textures
 * were rendered from: the source tiles drawn into them, the source data
 * revision, and the map zoom at render time (zoom-dependent style properties
 * are evaluated then).
 *
 * @internal
 */
export class RTTFingerprint {
    private readonly _tileKeys: string;
    private readonly _revision: number;
    private readonly _zoom: number;

    constructor(coords: OverscaledTileID[], revision: number, zoom: number) {
        this._tileKeys = coords.map(c => c.key).sort().join();
        this._revision = revision;
        this._zoom = zoom;
    }

    equals(other: RTTFingerprint | undefined): boolean {
        return this.equalsIgnoringZoom(other) && this._zoom === other._zoom;
    }

    /**
     * Returns whether the source tiles and revision match, without comparing zoom.
     * Used to keep a texture on screen while the zoom is still changing and only
     * re-render it once the zoom has settled.
     */
    equalsIgnoringZoom(other: RTTFingerprint | undefined): boolean {
        if (other === undefined) return false;
        return this._tileKeys === other._tileKeys && this._revision === other._revision;
    }
}
