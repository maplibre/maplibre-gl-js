import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat';
import {IReadonlyTransform} from '../transform_interface';
import {ICameraHelper} from './camera_helper';

/**
 * @internal
 */
export class MercatorCameraHelper implements ICameraHelper {
    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    } {
        return {
            easingOffset: pan,
            easingCenter: transform.center,
        };
    }
}
