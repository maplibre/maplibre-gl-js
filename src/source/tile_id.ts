import {getTileBBox} from '@mapbox/whoots-js';
import {EXTENT} from '../data/extent';
import Point from '@mapbox/point-geometry';
import {MercatorCoordinate} from '../geo/mercator_coordinate';
import {register} from '../util/web_worker_transfer';
import {type mat4} from 'gl-matrix';
import {type ICanonicalTileID, type IMercatorCoordinate} from '@maplibre/maplibre-gl-style-spec';
import {MAX_TILE_ZOOM, MIN_TILE_ZOOM} from '../util/util';
import {isInBoundsForTileZoomXY} from '../util/world_bounds';

/**
 * A canonical way to define a tile ID
 */
export class CanonicalTileID implements ICanonicalTileID {
    z: number;
    x: number;
    y: number;
    key: string;

    constructor(z: number, x: number, y: number) {

        if (!isInBoundsForTileZoomXY(z, x, y)) {
            throw new Error(`x=${x}, y=${y}, z=${z} outside of bounds. 0<=x<${Math.pow(2, z)}, 0<=y<${Math.pow(2, z)} ${MIN_TILE_ZOOM}<=z<=${MAX_TILE_ZOOM} `);
        }

        this.z = z;
        this.x = x;
        this.y = y;
        this.key = calculateTileKey(0, z, z, x, y);
    }

    equals(id: ICanonicalTileID) {
        return this.z === id.z && this.x === id.x && this.y === id.y;
    }

    /**
     * given a list of urls, choose a url template and return a tile URL
     */
    url(urls: Array<string>, pixelRatio: number, scheme?: string | null) {
        const bbox = getTileBBox(this.x, this.y, this.z);
        const quadkey = getQuadkey(this.z, this.x, this.y);

        return urls[(this.x + this.y) % urls.length]
            .replace(/{prefix}/g, (this.x % 16).toString(16) + (this.y % 16).toString(16))
            .replace(/{z}/g, String(this.z))
            .replace(/{x}/g, String(this.x))
            .replace(/{y}/g, String(scheme === 'tms' ? (Math.pow(2, this.z) - this.y - 1) : this.y))
            .replace(/{ratio}/g, pixelRatio > 1 ? '@2x' : '')
            .replace(/{quadkey}/g, quadkey)
            .replace(/{bbox-epsg-3857}/g, bbox);
    }

    isChildOf(parent: ICanonicalTileID) {
        const dz = this.z - parent.z;
        return  dz > 0 && parent.x === (this.x >> dz) && parent.y === (this.y >> dz);
    }

    getTilePoint(coord: IMercatorCoordinate) {
        const tilesAtZoom = Math.pow(2, this.z);
        return new Point(
            (coord.x * tilesAtZoom - this.x) * EXTENT,
            (coord.y * tilesAtZoom - this.y) * EXTENT);
    }

    toString() {
        return `${this.z}/${this.x}/${this.y}`;
    }
}

/**
 * @internal
 * An unwrapped tile identifier
 */
export class UnwrappedTileID {
    wrap: number;
    canonical: CanonicalTileID;
    key: string;

    constructor(wrap: number, canonical: CanonicalTileID) {
        this.wrap = wrap;
        this.canonical = canonical;
        this.key = calculateTileKey(wrap, canonical.z, canonical.z, canonical.x, canonical.y);
    }
}

/**
 * An overscaled tile identifier
 */
export class OverscaledTileID {
    overscaledZ: number;
    wrap: number;
    canonical: CanonicalTileID;
    key: string;
    /**
     * This matrix is used during terrain's render-to-texture stage only.
     * If the render-to-texture stage is active, this matrix will be present
     * and should be used, otherwise this matrix will be null.
     * The matrix should be float32 in order to avoid slow WebGL calls in Chrome.
     */
    terrainRttPosMatrix32f: mat4 | null = null;

    constructor(overscaledZ: number, wrap: number, z: number, x: number, y: number) {
        if (overscaledZ < z) throw new Error(`overscaledZ should be >= z; overscaledZ = ${overscaledZ}; z = ${z}`);
        this.overscaledZ = overscaledZ;
        this.wrap = wrap;
        this.canonical = new CanonicalTileID(z, +x, +y);
        this.key = calculateTileKey(wrap, overscaledZ, z, x, y);
    }

    clone() {
        return new OverscaledTileID(this.overscaledZ, this.wrap, this.canonical.z, this.canonical.x, this.canonical.y);
    }

    equals(id: OverscaledTileID) {
        return this.overscaledZ === id.overscaledZ && this.wrap === id.wrap && this.canonical.equals(id.canonical);
    }

    /**
     * Returns a new `OverscaledTileID` representing the tile at the target zoom level.
     * When targetZ is greater than the current canonical z, the canonical coordinates are unchanged.
     * When targetZ is less than the current canonical z, the canonical coordinates are updated.
     * @param targetZ - the zoom level to scale to. Must be less than or equal to this.overscaledZ
     * @returns a new OverscaledTileID representing the tile at the target zoom level
     * @throws if targetZ > this.overscaledZ
     */
    scaledTo(targetZ: number) {
        if (targetZ > this.overscaledZ) throw new Error(`targetZ > this.overscaledZ; targetZ = ${targetZ}; overscaledZ = ${this.overscaledZ}`);
        const zDifference = this.canonical.z - targetZ;
        if (targetZ > this.canonical.z) {
            return new OverscaledTileID(targetZ, this.wrap, this.canonical.z, this.canonical.x, this.canonical.y);
        } else {
            return new OverscaledTileID(targetZ, this.wrap, targetZ, this.canonical.x >> zDifference, this.canonical.y >> zDifference);
        }
    }

    isOverscaled() {
        return (this.overscaledZ > this.canonical.z);
    }

    /*
     * calculateScaledKey is an optimization:
     * when withWrap == true, implements the same as this.scaledTo(z).key,
     * when withWrap == false, implements the same as this.scaledTo(z).wrapped().key.
     */
    calculateScaledKey(targetZ: number, withWrap: boolean): string {
        if (targetZ > this.overscaledZ) throw new Error(`targetZ > this.overscaledZ; targetZ = ${targetZ}; overscaledZ = ${this.overscaledZ}`);
        const zDifference = this.canonical.z - targetZ;
        if (targetZ > this.canonical.z) {
            return calculateTileKey(this.wrap * +withWrap, targetZ, this.canonical.z, this.canonical.x, this.canonical.y);
        } else {
            return calculateTileKey(this.wrap * +withWrap, targetZ, targetZ, this.canonical.x >> zDifference, this.canonical.y >> zDifference);
        }
    }

    isChildOf(parent: OverscaledTileID): boolean {
        if (parent.wrap !== this.wrap) return false; // different world copy

        const zDifference = this.overscaledZ - parent.overscaledZ;
        if (zDifference <= 0) return false; // must be deeper zoom

        //special case for root tile (bitwise math doesn't work for root)
        if (parent.overscaledZ === 0) return this.overscaledZ > 0;

        const dz = this.canonical.z - parent.canonical.z;
        if (dz < 0) return false; // parent can't be deeper canonically

        return (
            parent.canonical.x === (this.canonical.x >> dz) &&
            parent.canonical.y === (this.canonical.y >> dz)
        );
    }

    children(sourceMaxZoom: number) {
        if (this.overscaledZ >= sourceMaxZoom) {
            // return a single tile coord representing a an overscaled tile
            return [new OverscaledTileID(this.overscaledZ + 1, this.wrap, this.canonical.z, this.canonical.x, this.canonical.y)];
        }

        const z = this.canonical.z + 1;
        const x = this.canonical.x * 2;
        const y = this.canonical.y * 2;
        return [
            new OverscaledTileID(z, this.wrap, z, x, y),
            new OverscaledTileID(z, this.wrap, z, x + 1, y),
            new OverscaledTileID(z, this.wrap, z, x, y + 1),
            new OverscaledTileID(z, this.wrap, z, x + 1, y + 1)
        ];
    }

    isLessThan(rhs: OverscaledTileID) {
        if (this.wrap < rhs.wrap) return true;
        if (this.wrap > rhs.wrap) return false;

        if (this.overscaledZ < rhs.overscaledZ) return true;
        if (this.overscaledZ > rhs.overscaledZ) return false;

        if (this.canonical.x < rhs.canonical.x) return true;
        if (this.canonical.x > rhs.canonical.x) return false;

        if (this.canonical.y < rhs.canonical.y) return true;
        return false;
    }

    wrapped() {
        return new OverscaledTileID(this.overscaledZ, 0, this.canonical.z, this.canonical.x, this.canonical.y);
    }

    unwrapTo(wrap: number) {
        return new OverscaledTileID(this.overscaledZ, wrap, this.canonical.z, this.canonical.x, this.canonical.y);
    }

    overscaleFactor() {
        return Math.pow(2, this.overscaledZ - this.canonical.z);
    }

    toUnwrapped() {
        return new UnwrappedTileID(this.wrap, this.canonical);
    }

    toString() {
        return `${this.overscaledZ}/${this.canonical.x}/${this.canonical.y}`;
    }

    getTilePoint(coord: MercatorCoordinate) {
        return this.canonical.getTilePoint(new MercatorCoordinate(coord.x - this.wrap, coord.y));
    }
}

export function calculateTileKey(wrap: number, overscaledZ: number, z: number, x: number, y: number): string {
    wrap *= 2;
    if (wrap < 0) wrap = wrap * -1 - 1;
    const dim = 1 << z;
    return (dim * dim * wrap + dim * y + x).toString(36) + z.toString(36) + overscaledZ.toString(36);
}

function getQuadkey(z, x, y) {
    let quadkey = '', mask;
    for (let i = z; i > 0; i--) {
        mask = 1 << (i - 1);
        quadkey += ((x & mask ? 1 : 0) + (y & mask ? 2 : 0));
    }
    return quadkey;
}

register('CanonicalTileID', CanonicalTileID);
register('OverscaledTileID', OverscaledTileID, {omit: ['terrainRttPosMatrix32f']});
