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
            const params = this._getHashParams();
            params.set(this._hashName, hash);
            // Manually build the string to avoid URL encoding the hash value
            return `#${this._buildHashString(params)}`;
        }

        return `#${hash}`;
    }

    _getHashParams = () => {
        return new URLSearchParams(window.location.hash.replace('#', ''));
    };

    _buildHashString = (params: URLSearchParams) => {
        const entries = Array.from(params.entries());
        if (entries.length === 0) return '';
        return entries.map(([key, value]) => `${key}=${value}`).join('&');
    };

    _getCurrentHash = () => {
        // Get the current hash from location, stripped from its number sign
        if (this._hashName) {
            const params = this._getHashParams();
            return (params.get(this._hashName) || '').split('/');
        }
        return window.location.hash.replace('#', '').split('/');
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
        const params = this._getHashParams();

        if (this._hashName) {
            params.delete(this._hashName);
        } else {
            // For unnamed hash (#zoom/lat/lng&other=params), remove first entry
            const entries = Array.from(params.entries());
            if (entries.length > 0) {
                params.delete(entries[0][0]);
            }
        }

        // Manually build the string to avoid URL encoding
        const newHash = this._buildHashString(params);
        const location = window.location.href.replace(/(#.*)?$/, newHash ? `#${newHash}` : '');
        window.history.replaceState(window.history.state, null, location);
    };

    /**
     * Mobile Safari doesn't allow updating the hash more than 100 times per 30 seconds.
     */
    _updateHash: () => ReturnType<typeof setTimeout> = throttle(this._updateHashUnthrottled, 30 * 1000 / 100);

    _isValidHash(hash: string[]) {
        if (hash.length < 3 || hash.some(h => isNaN(+h))) {
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
