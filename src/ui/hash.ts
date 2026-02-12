import {throttle} from '../util/throttle';
import {LngLat} from '../geo/lng_lat';

import type {Map} from './map';

/**
 * Adds the map's position to its page's location hash.
 * Passed as an option to the map object.
 *
 * @group Markers and Controls
 */
export class Hash {
    _map: Map;
    _hashName: string;

    constructor(hashName?: string | null) {
        this._hashName = hashName && encodeURIComponent(hashName);
    }

    /**
     * Map element to listen for coordinate changes
     *
     * @param map - The map object
     */
    addTo(map: Map) {
        this._map = map;
        addEventListener('hashchange', this._onHashChange, false);
        this._map.on('moveend', this._updateHash);
        return this;
    }

    /**
     * Removes hash
     */
    remove() {
        removeEventListener('hashchange', this._onHashChange, false);
        this._map.off('moveend', this._updateHash);
        clearTimeout(this._updateHash());
        this._removeHash();

        delete this._map;
        return this;
    }

    getHashString(mapFeedback?: boolean) {
        const center = this._map.getCenter(),
            zoom = Math.round(this._map.getZoom() * 100) / 100,
            // derived from equation: 512px * 2^z / 360 / 10^d < 0.5px
            precision = Math.ceil((zoom * Math.LN2 + Math.log(512 / 360 / 0.5)) / Math.LN10),
            m = Math.pow(10, precision),
            lng = Math.round(center.lng * m) / m,
            lat = Math.round(center.lat * m) / m,
            bearing = this._map.getBearing(),
            pitch = this._map.getPitch();
        let hash = '';
        if (mapFeedback) {
            // new map feedback site has some constraints that don't allow
            // us to use the same hash format as we do for the Map hash option.
            hash += `/${lng}/${lat}/${zoom}`;
        } else {
            hash += `${zoom}/${lat}/${lng}`;
        }

        if (bearing || pitch) hash += (`/${Math.round(bearing * 10) / 10}`);
        if (pitch) hash += (`/${Math.round(pitch)}`);

        if (this._hashName) {
            const params = this._parseHash();
            let found = false;
            for (let i = 0; i < params.length; i++) {
                if (params[i][0] === this._hashName) {
                    params[i] = [this._hashName, hash];
                    found = true;
                    break;
                }
            }
            if (!found) {
                params.push([this._hashName, hash]);
            }
            return `#${this._serializeParams(params)}`;
        }

        return `#${hash}`;
    }

    /**
     * Parse the current hash fragment into a Map of key-value pairs.
     * Handles the `&`-separated `key=value` format used in named hash mode.
     * Unlike URLSearchParams, this preserves slashes and colons in values
     * without encoding them.
     */
    /**
     * Parse the current hash fragment into an array of `[key, value]` pairs.
     * Handles the `&`-separated `key=value` format used in named hash mode.
     * Unlike URLSearchParams, this preserves slashes and colons in values
     * without encoding them, and preserves the distinction between `key`
     * (no equals) and `key=` (empty value).
     */
    _parseHash(): Array<[string, string | null]> {
        const rawHash = window.location.hash.slice(1);
        const result: Array<[string, string | null]> = [];
        if (!rawHash) return result;
        for (const part of rawHash.split('&')) {
            if (!part) continue;
            const eqIdx = part.indexOf('=');
            if (eqIdx === -1) {
                result.push([part, null]);
            } else {
                result.push([part.slice(0, eqIdx), part.slice(eqIdx + 1)]);
            }
        }
        return result;
    }

    /**
     * Serialize an array of `[key, value]` pairs into an `&`-separated string.
     * Values are written as-is (no percent-encoding of slashes or colons).
     * Preserves the distinction between `key` (no equals) and `key=` (empty value).
     */
    _serializeParams(params: Array<[string, string | null]>): string {
        return params.map(([key, value]) =>
            value !== null ? `${key}=${value}` : key
        ).join('&');
    }

    _getCurrentHash = () => {
        // Get the current hash from location, stripped from its number sign
        const rawHash = window.location.hash.replace('#', '');
        if (this._hashName) {
            const params = this._parseHash();
            const entry = params.find(([key]) => key === this._hashName);
            const value = entry ? (entry[1] || '') : '';
            return value.split('/');
        }
        return rawHash.split('/');
    };

    _onHashChange = () => {
        const hash = this._getCurrentHash();

        if (!this._isValidHash(hash)) {
            return false;
        }

        const bearing = this._map.dragRotate.isEnabled() && this._map.touchZoomRotate.isEnabled() ? +(hash[3] || 0) : this._map.getBearing();
        this._map.jumpTo({
            center: [+hash[2], +hash[1]],
            zoom: +hash[0],
            bearing,
            pitch: +(hash[4] || 0)
        });

        return true;
    };

    _updateHashUnthrottled = () => {
        // Replace if already present, else append the updated hash string
        const location = window.location.href.replace(/(#.*)?$/, this.getHashString());
        window.history.replaceState(window.history.state, null, location);
    };

    _removeHash = () => {
        const rawHash = window.location.hash.slice(1);
        if (!rawHash) return;

        if (this._hashName) {
            const params = this._parseHash().filter(([key]) => key !== this._hashName);
            const remaining = this._serializeParams(params);
            const replaceString = remaining ? `#${remaining}` : '';
            const location = window.location.href.replace(/(#.*)?$/, replaceString);
            window.history.replaceState(window.history.state, null, location);
        } else {
            // For unnamed hashes, the map hash is the first part before any '&'.
            // Preserve any other parameters that follow.
            const ampIdx = rawHash.indexOf('&');
            if (ampIdx !== -1) {
                const remaining = rawHash.slice(ampIdx + 1);
                const location = window.location.href.replace(/(#.*)?$/, remaining ? `#${remaining}` : '');
                window.history.replaceState(window.history.state, null, location);
            } else {
                const location = window.location.href.replace(/(#.*)?$/, '');
                window.history.replaceState(window.history.state, null, location);
            }
        }
    };

    /**
     * Mobile Safari doesn't allow updating the hash more than 100 times per 30 seconds.
     */
    _updateHash: () => ReturnType<typeof setTimeout> = throttle(this._updateHashUnthrottled, 30 * 1000 / 100);

    _isValidHash(hash: number[]) {
        if (hash.length < 3 || hash.some(isNaN)) {
            return false;
        }

        // LngLat() throws error if latitude is out of range, and it's valid if it succeeds.
        try {
            new LngLat(+hash[2], +hash[1]);
        } catch {
            return false;
        }

        const zoom = +hash[0];
        const bearing = +(hash[3] || 0);
        const pitch = +(hash[4] || 0);

        return zoom >= this._map.getMinZoom() && zoom <= this._map.getMaxZoom() &&
            bearing >= -180 && bearing <= 180 &&
            pitch >= this._map.getMinPitch() && pitch <= this._map.getMaxPitch();
    };
}
