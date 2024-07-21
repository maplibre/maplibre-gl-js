import Point from '@mapbox/point-geometry';
import {IReadonlyTransform} from '../transform_interface';
import {LngLat} from '../lng_lat';

/**
 * @internal
 * Contains projection-specific functions related to camera controls, easeTo, flyTo, inertia, etc.
 */
export interface ICameraHelper {
    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    };
}
