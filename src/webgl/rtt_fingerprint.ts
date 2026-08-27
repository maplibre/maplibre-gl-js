import {type OverscaledTileID} from '../tile/tile_id.ts';

/**
 * @internal
 * Immutable value describing the state a render-to-texture tile's textures
 * were rendered from: the source tiles drawn into them, the source data
 * revision, and the map zoom at render time (zoom-dependent style properties
 * are evaluated then). A cached texture matches the screen exactly when its
 * fingerprint equals the one computed for the current frame.
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
     * Same source tiles at the same revision, regardless of the zoom the
     * texture was rendered at: such a texture only shows zoom-dependent style
     * properties at a stale zoom, so it can stay on screen while the zoom is
     * still changing and be re-rendered once the zoom settles.
     */
    equalsIgnoringZoom(other: RTTFingerprint | undefined): boolean {
        if (other === undefined) return false;
        return this._tileKeys === other._tileKeys && this._revision === other._revision;
    }
}
