import DOM from '../../util/dom';
import {bindAll} from '../../util/util';

import type Map from '../map';
import type {IControl} from './control';
import type {TerrainSpecification} from '../../style-spec/types.g';

/**
 * An `TerrainControl` control adds a button to turn terrain on and off.
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {string} [options.id] The ID of the raster-dem source to use.
 * @param {Object} [options.options]
 * @param {number} [options.options.elevationOffset]
 * @param {number} [options.options.exaggeration]
 * @example
 * var map = new maplibregl.Map({TerrainControl: false})
 *     .addControl(new maplibregl.TerrainControl({
 *         source: "terrain"
 *     }));
 */
export default class TerrainControl implements IControl {
    options: TerrainSpecification;
    _map: Map;
    _container: HTMLElement;
    _terrainButton: HTMLButtonElement;

    constructor(options: TerrainSpecification) {
        this.options = options;

        bindAll([
            '_toggleTerrain',
            '_updateTerrainIcon',
        ], this);
    }

    onAdd(map: Map) {
        this._map = map;
        this._container = DOM.create('div', 'maplibregl-ctrl maplibregl-ctrl-group mapboxgl-ctrl mapboxgl-ctrl-group');
        this._terrainButton = DOM.create('button', 'maplibregl-ctrl-terrain mapboxgl-ctrl-terrain', this._container);
        DOM.create('span', 'maplibregl-ctrl-icon mapboxgl-ctrl-icon', this._terrainButton).setAttribute('aria-hidden', 'true');
        this._terrainButton.type = 'button';
        this._terrainButton.addEventListener('click', this._toggleTerrain);

        this._updateTerrainIcon();
        this._map.on('terrain', this._updateTerrainIcon);
        return this._container;
    }

    onRemove() {
        DOM.remove(this._container);
        this._map.off('terrain', this._updateTerrainIcon);
        this._map = undefined;
    }

    _toggleTerrain() {
        if (this._map.getTerrain()) {
            this._map.setTerrain(null);
        } else {
            this._map.setTerrain(this.options);
        }
        this._updateTerrainIcon();
    }

    _updateTerrainIcon() {
        this._terrainButton.classList.remove('maplibregl-ctrl-terrain', 'mapboxgl-ctrl-terrain');
        this._terrainButton.classList.remove('maplibregl-ctrl-terrain-enabled', 'mapboxgl-ctrl-terrain-enabled');
        if (this._map.style.terrain) {
            this._terrainButton.classList.add('maplibregl-ctrl-terrain-enabled', 'mapboxgl-ctrl-terrain-enabled');
            this._terrainButton.title = this._map._getUIString('TerrainControl.disableTerrain');
        } else {
            this._terrainButton.classList.add('maplibregl-ctrl-terrain', 'mapboxgl-ctrl-terrain');
            this._terrainButton.title = this._map._getUIString('TerrainControl.enableTerrain');
        }
    }
}
