import {DOM} from '../../util/dom';
import {extend} from '../../util/util';

import type {Map} from '../map';
import type {ControlPosition, IControl} from './control';

export type Unit = 'imperial' | 'metric' | 'nautical';

/**
 * Options for the `ScaleControl`.
 */
type ScaleOptions = {
    maxWidth?: number;
    unit?: Unit;
};

const defaultOptions: ScaleOptions = {
    maxWidth: 100,
    unit: 'metric'
};

/**
 * A `ScaleControl` control displays the ratio of a distance on the map to the corresponding distance on the ground.
 *
 * @implements {IControl}
 * @param {ScaleOptions} [options]
 * @param {number} [options.maxWidth='100'] The maximum length of the scale control in pixels.
 * @param {string} [options.unit='metric'] Unit of the distance (`'imperial'`, `'metric'` or `'nautical'`).
 * @example
 * var scale = new maplibregl.ScaleControl({
 *     maxWidth: 80,
 *     unit: 'imperial'
 * });
 * map.addControl(scale);
 *
 * scale.setUnit('metric');
 */
export class ScaleControl implements IControl {
    _map: Map;
    _container: HTMLElement;
    options: ScaleOptions;

    /**
     * Constructs a new instance of the `ScaleControl` class with the provided options.
     * @param {ScaleOptions} options - The options for the `ScaleControl`.
     */
    constructor(options: ScaleOptions) {
        this.options = extend({}, defaultOptions, options);
    }
    /**
     * Gets the default position of the `ScaleControl`.
     * @returns {ControlPosition} - The default position of the control.
     */
    getDefaultPosition(): ControlPosition {
        return 'bottom-left';
    }
    /**
     * Event handler for the 'move' event.
     * @private
     */
    _onMove = () => {
        updateScale(this._map, this._container, this.options);
    };
    /**
     * Adds the `ScaleControl` to the map.
     * @param {Map} map - The map instance to which the control is added.
     * @returns {HTMLElement} - The container element of the control.
     */
    onAdd(map: Map) {
        this._map = map;
        this._container = DOM.create('div', 'maplibregl-ctrl maplibregl-ctrl-scale', map.getContainer());

        this._map.on('move', this._onMove);
        this._onMove();

        return this._container;
    }
    /**
     * Removes the `ScaleControl` from the map.
     */
    onRemove() {
        DOM.remove(this._container);
        this._map.off('move', this._onMove);
        this._map = undefined;
    }

    /**
     * Sets the unit of the scale's distance.
     * @param {Unit} unit - The unit of the distance (`'imperial'`, `'metric'`, or `'nautical'`).
     */
    setUnit = (unit: Unit): void => {
        this.options.unit = unit;
        updateScale(this._map, this._container, this.options);
    };
}

/**
 * Updates the scale control based on the map's current state.
 * @param {Map} map - The map instance.
 * @param {HTMLElement} container - The container element of the scale control.
 * @param {ScaleOptions} options - The options for the scale control.
 */
function updateScale(map, container, options): void {
    // A horizontal scale is imagined to be present at center of the map
    // container with maximum length (Default) as 100px.
    // Using spherical law of cosines approximation, the real distance is
    // found between the two coordinates.
    const maxWidth = options && options.maxWidth || 100;

    const y = map._container.clientHeight / 2;
    const left = map.unproject([0, y]);
    const right = map.unproject([maxWidth, y]);
    const maxMeters = left.distanceTo(right);
    // The real distance corresponding to 100px scale length is rounded off to
    // near pretty number and the scale length for the same is found out.
    // Default unit of the scale is based on User's locale.
    if (options && options.unit === 'imperial') {
        const maxFeet = 3.2808 * maxMeters;
        if (maxFeet > 5280) {
            const maxMiles = maxFeet / 5280;
            setScale(container, maxWidth, maxMiles, map._getUIString('ScaleControl.Miles'));
        } else {
            setScale(container, maxWidth, maxFeet, map._getUIString('ScaleControl.Feet'));
        }
    } else if (options && options.unit === 'nautical') {
        const maxNauticals = maxMeters / 1852;
        setScale(container, maxWidth, maxNauticals, map._getUIString('ScaleControl.NauticalMiles'));
    } else if (maxMeters >= 1000) {
        setScale(container, maxWidth, maxMeters / 1000, map._getUIString('ScaleControl.Kilometers'));
    } else {
        setScale(container, maxWidth, maxMeters, map._getUIString('ScaleControl.Meters'));
    }
}
/**
 * Sets the scale on the scale control element.
 * @param {HTMLElement} container - The container element of the scale control.
 * @param {number} maxWidth - The maximum width of the scale control in pixels.
 * @param {number} maxDistance - The maximum distance to be displayed on the scale control.
 * @param {string} unit - The unit of distance for the scale control.
 */
function setScale(container, maxWidth, maxDistance, unit):void  {
    const distance = getRoundNum(maxDistance);
    const ratio = distance / maxDistance;
    container.style.width = `${maxWidth * ratio}px`;
    container.innerHTML = `${distance}&nbsp;${unit}`;
}

/**
 * Rounds a decimal number to a near pretty number.
 * @param {number} d - The decimal number to be rounded.
 * @returns {number} The rounded number.
 */
function getDecimalRoundNum(d):number {
    const multiplier = Math.pow(10, Math.ceil(-Math.log(d) / Math.LN10));
    return Math.round(d * multiplier) / multiplier;
}
/**
 * Rounds a number to a near pretty number based on a set of predefined thresholds.
 * @param {number} num - The number to be rounded.
 * @returns {number} The rounded number.
 */
function getRoundNum(num):number {
    const pow10 = Math.pow(10, (`${Math.floor(num)}`).length - 1);
    let d = num / pow10;

    d = d >= 10 ? 10 :
        d >= 5 ? 5 :
            d >= 3 ? 3 :
                d >= 2 ? 2 :
                    d >= 1 ? 1 : getDecimalRoundNum(d);

    return pow10 * d;
}
