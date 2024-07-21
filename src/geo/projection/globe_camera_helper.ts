import Point from '@mapbox/point-geometry';
import {IReadonlyTransform} from '../transform_interface';
import {ICameraHelper} from './camera_helper';
import {GlobeProjection} from './globe';
import {LngLat} from '../lng_lat';
import {MercatorCameraHelper} from './mercator_camera_helper';
import {computeGlobePanCenter} from './globe_utils';

/**
 * @internal
 */
export class GlobeCameraHelper implements ICameraHelper {
    private _globe: GlobeProjection;
    private _mercatorCameraHelper: MercatorCameraHelper;

    constructor(globe: GlobeProjection) {
        this._globe = globe;
        this._mercatorCameraHelper = new MercatorCameraHelper();
    }

    private get useGlobeControls(): boolean { return this._globe.useGlobeRendering; }

    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    } {
        if (!this.useGlobeControls) {
            return this._mercatorCameraHelper.handlePanInertia(pan, transform);
        }

        const panCenter = computeGlobePanCenter(pan, transform);
        if (Math.abs(panCenter.lng - transform.center.lng) > 180) {
            // If easeTo target would be over 180° distant, the animation would move
            // in the opposite direction that what the user intended.
            // Thus we clamp the movement to 179.5°.
            panCenter.lng = transform.center.lng + 179.5 * Math.sign(panCenter.lng - transform.center.lng);
        }
        return {
            easingCenter: panCenter,
            easingOffset: new Point(0, 0),
        };
    }
}
