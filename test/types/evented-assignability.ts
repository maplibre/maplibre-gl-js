/**
 * `Evented` is exported as the base of every evented class, so `Map`, `Marker`
 * and `Popup` must be assignable to it.
 */
import type {Evented, Map, Marker, Popup} from '../../dist/maplibre-gl';

declare const map: Map;
declare const marker: Marker;
declare const popup: Popup;

export const eventedMap: Evented = map;
export const eventedMarker: Evented = marker;
export const eventedPopup: Evented = popup;
