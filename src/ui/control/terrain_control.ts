import {DOM} from '../../util/dom';

import type {Map} from '../map';
import type {IControl} from './control';
import type {TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';

/**
 * A `TerrainControl` control contains a button for turning the terrain on and off.
 *
 * @group Markers and Controls
 *
 * @example
 * ```ts
 * let map = new Map({TerrainControl: false})
 *     .addControl(new TerrainControl({
 *         source: "terrain"
 *     }));
 * ```
 */
export class TerrainControl implements IControl {
    options: TerrainSpecification;
    _map: Map;
    _container: HTMLElement;
    _terrainButton: HTMLButtonElement;

    /**
     * @param options - the control's options
     */
    constructor(options: TerrainSpecification) {
        this.options = options;
    }

    /** {@inheritDoc IControl.onAdd} */
    onAdd(map: Map) {
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

    /** {@inheritDoc IControl.onRemove} */
    onRemove() {
        DOM.remove(this._container);
        this._map.off('terrain', this._updateTerrainIcon);
        this._map = undefined;
    }

    _toggleTerrain = () => {
        if (this._map.getTerrain()) {
            this._map.setTerrain(null);
        } else {
            this._map.setTerrain(this.options);
        }
        this._updateTerrainIcon();
    };

    _updateTerrainIcon = () => {
        this._terrainButton.classList.remove('maplibregl-ctrl-terrain');
        this._terrainButton.classList.remove('maplibregl-ctrl-terrain-enabled');
        if (this._map.terrain) {
            this._terrainButton.classList.add('maplibregl-ctrl-terrain-enabled');
            this._terrainButton.title = this._map._getUIString('TerrainControl.Disable');
        } else {
            this._terrainButton.classList.add('maplibregl-ctrl-terrain');
            this._terrainButton.title = this._map._getUIString('TerrainControl.Enable');
        }
    };
}
