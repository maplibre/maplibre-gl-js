import {DOM} from '../../util/dom';

import type {Map} from '../map';
import type {ControlPosition, IControl} from './control';

/**
 * The unit type for length to use for the {@link ScaleControl}
 */
export type Unit = 'imperial' | 'metric' | 'nautical';

/**
 * The {@link ScaleControl} options object
 */
type ScaleControlOptions = {
    /**
     * The maximum length of the scale control in pixels.
     * @defaultValue 100
     */
    maxWidth?: number;
    /**
     * Unit of the distance (`'imperial'`, `'metric'` or `'nautical'`).
     * @defaultValue 'metric'
     */
    unit?: Unit;
};

const defaultOptions: ScaleControlOptions = {
    maxWidth: 100,
    unit: 'metric'
};

/**
 * A `ScaleControl` control displays the ratio of a distance on the map to the corresponding distance on the ground.
 *
 * @group Markers and Controls
 *
 * @example
 * ```ts
 * let scale = new ScaleControl({
 *     maxWidth: 80,
 *     unit: 'imperial'
 * });
 * map.addControl(scale);
 *
 * scale.setUnit('metric');
 * ```
 */
export class ScaleControl implements IControl {
    _map: Map;
    _container: HTMLElement;
    options: ScaleControlOptions;

    /**
     * @param options - the control's options
     */
    constructor(options?: ScaleControlOptions) {
        this.options = {...defaultOptions, ...options};
    }

    getDefaultPosition(): ControlPosition {
        return 'bottom-left';
    }

    _onMove = () => {
        updateScale(this._map, this._container, this.options);
    };

    /** {@inheritDoc IControl.onAdd} */
    onAdd(map: Map) {
        this._map = map;
        this._container = DOM.create('div', 'maplibregl-ctrl maplibregl-ctrl-scale', map.getContainer());

        this._map.on('move', this._onMove);
        this._onMove();

        return this._container;
    }

    /** {@inheritDoc IControl.onRemove} */
    onRemove() {
        DOM.remove(this._container);
        this._map.off('move', this._onMove);
        this._map = undefined;
    }

    /**
     * Set the scale's unit of the distance
     *
     * @param unit - Unit of the distance (`'imperial'`, `'metric'` or `'nautical'`).
     */
    setUnit = (unit: Unit) => {
        this.options.unit = unit;
        updateScale(this._map, this._container, this.options);
    };
}

function updateScale(map: Map, container: HTMLElement, options: ScaleControlOptions) {
    // A horizontal scale is imagined to be present at center of the map
    // container with maximum length (Default) as 100px.
    // Using spherical law of cosines approximation, the real distance is
    // found between the two coordinates.
    // Minimum maxWidth is calculated for the scale box.
    const optWidth = options && options.maxWidth || 100;
    const y = map._container.clientHeight / 2;
    const x = map._container.clientWidth / 2;
    const left = map.unproject([x - optWidth / 2, y]);
    const right = map.unproject([x + optWidth / 2, y]);

    const globeWidth = Math.round(map.project(right).x - map.project(left).x);
    const maxWidth = Math.min(optWidth, globeWidth, map._container.clientWidth);

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

function setScale(container: HTMLElement, maxWidth: number, maxDistance: number, unit: string) {
    const distance = getRoundNum(maxDistance);
    const ratio = distance / maxDistance;
    container.style.width = `${maxWidth * ratio}px`;
    container.innerHTML = `${distance}&nbsp;${unit}`;
}

function getDecimalRoundNum(d) {
    const multiplier = Math.pow(10, Math.ceil(-Math.log(d) / Math.LN10));
    return Math.round(d * multiplier) / multiplier;
}

function getRoundNum(num) {
    const pow10 = Math.pow(10, (`${Math.floor(num)}`).length - 1);
    let d = num / pow10;

    d = d >= 10 ? 10 :
        d >= 5 ? 5 :
            d >= 3 ? 3 :
                d >= 2 ? 2 :
                    d >= 1 ? 1 : getDecimalRoundNum(d);

    return pow10 * d;
}
