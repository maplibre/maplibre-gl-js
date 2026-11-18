import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from './events.ts';

import type {Map} from './map.ts';
import type {MapGeoJSONFeature} from '../util/vectortile_to_geojson.ts';

/**
 * @internal
 * Creates a map's mouse, touch and wheel events. An event locates itself on the map it belongs to, so the factory
 * holds the map, and the handlers that turn DOM input into map events need only the factory.
 */
export class MapEventFactory {
    private readonly _map: Map;

    constructor(map: Map) {
        this._map = map;
    }

    /** @param data - the features under the pointer, for an event that a layer's listener receives */
    createMouseEvent(type: string, originalEvent: MouseEvent, data?: {features: MapGeoJSONFeature[]}): MapMouseEvent {
        return new MapMouseEvent(type, this._map, originalEvent, data);
    }

    createTouchEvent(type: string, originalEvent: TouchEvent): MapTouchEvent {
        return new MapTouchEvent(type, this._map, originalEvent);
    }

    createWheelEvent(originalEvent: WheelEvent): MapWheelEvent {
        return new MapWheelEvent(this._map, originalEvent);
    }
}
