import {DOM} from '../../util/dom';

import type {Map} from '../map';
import type {IControl} from './control';

/**
 * A `GlobeControl` control contains a button for toggling the map projection between "mercator" and "globe".
 *
 * @group Markers and Controls
 *
 * @example
 * ```ts
 * let map = new Map()
 *     .addControl(new GlobeControl());
 * ```
 * 
 * @see [Display a globe with a fill extrusion layer](https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-a-fill-extrusion-layer/)
 */
export class GlobeControl implements IControl {
    _map: Map;
    _container: HTMLElement;
    _globeButton: HTMLButtonElement;

    /** {@inheritDoc IControl.onAdd} */
    onAdd(map: Map) {
        this._map = map;
        this._container = DOM.create('div', 'maplibregl-ctrl maplibregl-ctrl-group');
        this._globeButton = DOM.create('button', 'maplibregl-ctrl-globe', this._container);
        DOM.create('span', 'maplibregl-ctrl-icon', this._globeButton).setAttribute('aria-hidden', 'true');
        this._globeButton.type = 'button';
        this._globeButton.addEventListener('click', this._toggleProjection);

        this._updateGlobeIcon();
        this._map.on('styledata', this._updateGlobeIcon);
        return this._container;
    }

    /** {@inheritDoc IControl.onRemove} */
    onRemove() {
        DOM.remove(this._container);
        this._map.off('styledata', this._updateGlobeIcon);
        this._globeButton.removeEventListener('click', this._toggleProjection);
        this._map = undefined;
    }

    _toggleProjection = () => {
        const currentProjection = this._map.getProjection()?.type;
        if (currentProjection === 'mercator' || !currentProjection) {
            this._map.setProjection({type: 'globe'});
        } else {
            this._map.setProjection({type: 'mercator'});
        }
        this._updateGlobeIcon();
    };

    _updateGlobeIcon = () => {
        this._globeButton.classList.remove('maplibregl-ctrl-globe');
        this._globeButton.classList.remove('maplibregl-ctrl-globe-enabled');
        if (this._map.getProjection()?.type === 'globe') {
            this._globeButton.classList.add('maplibregl-ctrl-globe-enabled');
            this._globeButton.title = this._map._getUIString('GlobeControl.Disable');
        } else {
            this._globeButton.classList.add('maplibregl-ctrl-globe');
            this._globeButton.title = this._map._getUIString('GlobeControl.Enable');
        }
    };
}
