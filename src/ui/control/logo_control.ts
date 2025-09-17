import {DOM} from '../../util/dom';

import type {Map} from '../map';
import type {ControlPosition, IControl} from './control';

/**
 * The {@link LogoControl} options object
 */
export type LogoControlOptions = {
    /**
     * If `true`, force a compact logo.
     * If `false`, force the full logo. The default is a responsive logo that collapses when the map is less than 640 pixels wide.
     */
    compact?: boolean;
};

/**
 * A `LogoControl` is a control that adds the watermark.
 *
 * @group Markers and Controls
 *
 * @example
 * ```ts
 * map.addControl(new LogoControl({compact: false}));
 * ```
 **/
export class LogoControl implements IControl {
    options: LogoControlOptions;
    _map: Map;
    _compact: boolean;
    _container: HTMLElement;

    /**
     * @param options - the control's options
     */
    constructor(options: LogoControlOptions = {}) {
        this.options = options;
    }

    getDefaultPosition(): ControlPosition {
        return 'bottom-left';
    }

    /** {@inheritDoc IControl.onAdd} */
    onAdd(map: Map) {
        this._map = map;
        this._compact = this.options && this.options.compact;
        this._container = DOM.create('div', 'maplibregl-ctrl');
        const anchor = DOM.create('a', 'maplibregl-ctrl-logo');
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

    /** {@inheritDoc IControl.onRemove} */
    onRemove() {
        DOM.remove(this._container);
        this._map.off('resize', this._updateCompact);
        this._map = undefined;
        this._compact = undefined;
    }

    _updateCompact = () => {
        const containerChildren = this._container.children;
        if (containerChildren.length) {
            const anchor = containerChildren[0];
            if (this._map.getCanvasContainer().offsetWidth <= 640 || this._compact) {
                if (this._compact !== false) {
                    anchor.classList.add('maplibregl-compact');
                }
            } else {
                anchor.classList.remove('maplibregl-compact');
            }
        }
    };

}
