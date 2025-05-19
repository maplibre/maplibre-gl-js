import {DOM} from '../../util/dom';

import type {Map} from '../map';
import type {ControlPosition, IControl} from './control';
import type {MapDataEvent} from '../events';
import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
/**
 * The {@link AttributionControl} options object
 */
export type AttributionControlOptions = {
    /**
     * If `true`, the attribution control will always collapse when moving the map. If `false`,
     * force the expanded attribution control. The default is a responsive attribution that collapses when the user moves the map on maps less than 640 pixels wide.
     * **Attribution should not be collapsed if it can comfortably fit on the map. `compact` should only be used to modify default attribution when map size makes it impossible to fit default attribution and when the automatic compact resizing for default settings are not sufficient.**
     */
    compact?: boolean;
    /**
     * Attributions to show in addition to any other attributions.
     */
    customAttribution?: string | Array<string>;
};

export const defaultAttributionControlOptions: AttributionControlOptions = {
    compact: true,
    customAttribution: '<a href="https://maplibre.org/" target="_blank">MapLibre</a>'
};

/**
 * An `AttributionControl` control presents the map's attribution information. By default, the attribution control is expanded (regardless of map width).
 * @group Markers and Controls
 * @example
 * ```ts
 * let map = new Map({attributionControl: false})
 *     .addControl(new AttributionControl({
 *         compact: true
 *     }));
 * ```
 */
export class AttributionControl implements IControl {
    options: AttributionControlOptions;
    _map: Map;
    _compact: boolean | undefined;
    _container: HTMLElement;
    _innerContainer: HTMLElement;
    _compactButton: HTMLElement;
    _editLink: HTMLAnchorElement;
    _attribHTML: string;
    styleId: string;
    styleOwner: string;

    /**
     * @param options - the attribution options
     */
    constructor(options: AttributionControlOptions = defaultAttributionControlOptions) {
        this.options = options;
    }

    getDefaultPosition(): ControlPosition {
        return 'bottom-right';
    }

    /** {@inheritDoc IControl.onAdd} */
    onAdd(map: Map) {
        this._map = map;
        this._compact = this.options.compact;
        this._container = DOM.create('details', 'maplibregl-ctrl maplibregl-ctrl-attrib');
        this._compactButton = DOM.create('summary', 'maplibregl-ctrl-attrib-button', this._container);
        this._compactButton.addEventListener('click', this._toggleAttribution);
        this._setElementTitle(this._compactButton, 'ToggleAttribution');
        this._innerContainer = DOM.create('div', 'maplibregl-ctrl-attrib-inner', this._container);

        this._updateAttributions();
        this._updateCompact();

        this._map.on('styledata', this._updateData);
        this._map.on('sourcedata', this._updateData);
        this._map.on('terrain', this._updateData);
        this._map.on('resize', this._updateCompact);
        this._map.on('drag', this._updateCompactMinimize);

        return this._container;
    }

    /** {@inheritDoc IControl.onRemove} */
    onRemove() {
        DOM.remove(this._container);

        this._map.off('styledata', this._updateData);
        this._map.off('sourcedata', this._updateData);
        this._map.off('terrain', this._updateData);
        this._map.off('resize', this._updateCompact);
        this._map.off('drag', this._updateCompactMinimize);

        this._map = undefined;
        this._compact = undefined;
        this._attribHTML = undefined;
    }

    _setElementTitle(element: HTMLElement, title: 'ToggleAttribution' | 'MapFeedback') {
        const str = this._map._getUIString(`AttributionControl.${title}`);
        element.title = str;
        element.setAttribute('aria-label', str);
    }

    _toggleAttribution = () => {
        if (this._container.classList.contains('maplibregl-compact')) {
            if (this._container.classList.contains('maplibregl-compact-show')) {
                this._container.setAttribute('open', '');
                this._container.classList.remove('maplibregl-compact-show');
            } else {
                this._container.classList.add('maplibregl-compact-show');
                this._container.removeAttribute('open');
            }
        }
    };

    _updateData = (e: MapDataEvent) => {
        if (e && (e.sourceDataType === 'metadata' || e.sourceDataType === 'visibility' || e.dataType === 'style' || e.type === 'terrain')) {
            this._updateAttributions();
        }
    };

    _updateAttributions() {
        if (!this._map.style) return;
        let attributions: Array<string> = [];
        if (this.options.customAttribution) {
            if (Array.isArray(this.options.customAttribution)) {
                attributions = attributions.concat(
                    this.options.customAttribution.map(attribution => {
                        if (typeof attribution !== 'string') return '';
                        return attribution;
                    })
                );
            } else if (typeof this.options.customAttribution === 'string') {
                attributions.push(this.options.customAttribution);
            }
        }

        if (this._map.style.stylesheet) {
            const stylesheet = this._map.style.stylesheet as StyleSpecification & { owner: string; id: string };
            this.styleOwner = stylesheet.owner;
            this.styleId = stylesheet.id;
        }

        const sourceCaches = this._map.style.sourceCaches;
        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            if (sourceCache.used || sourceCache.usedForTerrain) {
                const source = sourceCache.getSource();
                if (source.attribution && attributions.indexOf(source.attribution) < 0) {
                    attributions.push(source.attribution);
                }
            }
        }

        // remove any entries that are whitespace
        attributions = attributions.filter(e => String(e).trim());

        // remove any entries that are substrings of another entry.
        // first sort by length so that substrings come first
        attributions.sort((a, b) => a.length - b.length);
        attributions = attributions.filter((attrib, i) => {
            for (let j = i + 1; j < attributions.length; j++) {
                if (attributions[j].indexOf(attrib) >= 0) { return false; }
            }
            return true;
        });

        // check if attribution string is different to minimize DOM changes
        const attribHTML = attributions.join(' | ');
        if (attribHTML === this._attribHTML) return;

        this._attribHTML = attribHTML;

        if (attributions.length) {
            this._innerContainer.innerHTML = DOM.sanitize(attribHTML);
            this._container.classList.remove('maplibregl-attrib-empty');
        } else {
            this._container.classList.add('maplibregl-attrib-empty');
        }
        this._updateCompact();
        // remove old DOM node from _editLink
        this._editLink = null;
    }

    _updateCompact = () => {
        if (this._map.getCanvasContainer().offsetWidth <= 640 || this._compact) {
            if (this._compact === false) {
                this._container.setAttribute('open', '');
            } else if (!this._container.classList.contains('maplibregl-compact') && !this._container.classList.contains('maplibregl-attrib-empty')) {
                this._container.setAttribute('open', '');
                this._container.classList.add('maplibregl-compact', 'maplibregl-compact-show');
            }
        } else {
            this._container.setAttribute('open', '');
            if (this._container.classList.contains('maplibregl-compact')) {
                this._container.classList.remove('maplibregl-compact', 'maplibregl-compact-show');
            }
        }
    };

    _updateCompactMinimize = () => {
        if (this._container.classList.contains('maplibregl-compact')) {
            if (this._container.classList.contains('maplibregl-compact-show')) {
                this._container.classList.remove('maplibregl-compact-show');
            }
        }
    };
}
