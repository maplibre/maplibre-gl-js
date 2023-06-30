import {DOM} from '../../util/dom';

import type {Map} from '../map';
import type {IControl} from './control';
import type {TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';

/**
 * A `TerrainControl` control contains a button for turning the terrain on and off.
 *
 * @implements {IControl}
 * @param {TerrainSpecification} [options]
 * @param {string} [options.source] The ID of the raster-dem source to use.
 * @param {number} [options.exaggeration]
 * @example
 * var map = new maplibregl.Map({TerrainControl: false})
 *     .addControl(new maplibregl.TerrainControl({
 *         source: "terrain"
 *     }));
 */
export class TerrainControl implements IControl {
    options: TerrainSpecification;
    _map: Map;
    _container: HTMLElement;
    _terrainButton: HTMLButtonElement;
    /**
     * Creates an instance of TerrainControl.
     * @param options - The options for the TerrainControl.
     */
    constructor(options: TerrainSpecification) {
        this.options = options;
    }
    /**
     * Adds the control to the map.
     * @param map - The map instance to add the control to.
     * @returns The container element of the control.
     */
    onAdd(map: Map):HTMLElement {
        this._map = map;
        this._container = DOM.create('div', 'maplibregl-ctrl maplibregl-ctrl-group');
        this._terrainButton = DOM.create('button', 'maplibregl-ctrl-terrain', this._container);
        DOM.create('span', 'maplibregl-ctrl-icon', this._terrainButton).setAttribute('aria-hidden', 'true');
        this._terrainButton.type = 'button';
        this._terrainButton.addEventListener('click', this._toggleTerrain);

        this._updateTerrainIcon();
        this._map.on('terrain', this._updateTerrainIcon);
        return this._container;
    }

    /**
     * Removes the control from the map.
     */
    onRemove(): void {
        DOM.remove(this._container);
        this._map.off('terrain', this._updateTerrainIcon);
        this._map = undefined;
    }

    /**
     * Toggles the terrain on and off.
     */
    private _toggleTerrain = (): void  => {
        if (this._map.getTerrain()) {
            this._map.setTerrain(null);
        } else {
            this._map.setTerrain(this.options);
        }
        this._updateTerrainIcon();
    };

    /**
     * Updates the terrain icon based on the current terrain state.
     */
    private _updateTerrainIcon = (): void => {
        this._terrainButton.classList.remove('maplibregl-ctrl-terrain');
        this._terrainButton.classList.remove('maplibregl-ctrl-terrain-enabled');
        if (this._map.terrain) {
            this._terrainButton.classList.add('maplibregl-ctrl-terrain-enabled');
            this._terrainButton.title = this._map._getUIString('TerrainControl.disableTerrain');
        } else {
            this._terrainButton.classList.add('maplibregl-ctrl-terrain');
            this._terrainButton.title = this._map._getUIString('TerrainControl.enableTerrain');
        }
    };
}
