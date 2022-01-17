import DOM from '../../util/dom';

import {bindAll} from '../../util/util';

import type Map from '../map';
import type {ControlPosition, IControl} from './control';

/**
 * A `LogoControl` is a control that adds the watermark.
 *
 * @implements {IControl}
 * @private
**/

class LogoControl implements IControl {
    _map: Map;
    _container: HTMLElement;

    constructor() {
        bindAll(['_updateLogo'], this);
        bindAll(['_updateCompact'], this);
    }

    onAdd(map: Map) {
        this._map = map;
        this._container = DOM.create('div', 'maplibregl-ctrl mapboxgl-ctrl');
        const anchor = DOM.create('a', 'maplibregl-ctrl-logo mapboxgl-ctrl-logo');
        anchor.target = '_blank';
        anchor.rel = 'noopener nofollow';
        anchor.href = 'https://maplibre.org/';
        anchor.setAttribute('aria-label', this._map._getUIString('LogoControl.Title'));
        anchor.setAttribute('rel', 'noopener nofollow');
        this._container.appendChild(anchor);
        this._container.style.display = 'block';

        this._map.on('resize', this._updateCompact);
        this._updateCompact();

        return this._container;
    }

    onRemove() {
        DOM.remove(this._container);
        this._map.off('resize', this._updateCompact);
    }

    getDefaultPosition(): ControlPosition {
        return 'bottom-left';
    }

    _updateCompact() {
        const containerChildren = this._container.children;
        if (containerChildren.length) {
            const anchor = containerChildren[0];
            if (this._map.getCanvasContainer().offsetWidth <= 640) {
                anchor.classList.add('maplibregl-compact', 'mapboxgl-compact');
            } else {
                anchor.classList.remove('maplibregl-compact', 'mapboxgl-compact');
            }
        }
    }

}

export default LogoControl;
