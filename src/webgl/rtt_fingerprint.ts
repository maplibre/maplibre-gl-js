import {type OverscaledTileID} from '../tile/tile_id.ts';

/**
 * @internal
 * Immutable value describing the state a render-to-texture tile's textures are
 * baked from: the source tiles rendered into them, the source data revision,
 * and the map zoom at bake time (zoom-dependent style properties are evaluated
 * when baking). A baked texture matches the screen exactly when its
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
     * Same source tiles at the same revision, regardless of bake zoom: such a
     * texture only renders zoom-dependent style properties at a stale zoom,
     * so it can be kept on screen until the zoom settles.
     */
    equalsIgnoringZoom(other: RTTFingerprint | undefined): boolean {
        if (other === undefined) return false;
        return this._tileKeys === other._tileKeys && this._revision === other._revision;
    }
}
