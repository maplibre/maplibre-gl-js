import Point from '@mapbox/point-geometry';
import {LngLat, LngLatLike} from '../lng_lat';
import {IReadonlyTransform, ITransform} from '../transform_interface';
import {cameraBoundsWarning, ICameraHelper, MapControlsDeltas} from './camera_helper';
import {CameraForBoundsOptions} from '../../ui/camera';
import {PaddingOptions} from '../edge_insets';
import {LngLatBounds} from '../lng_lat_bounds';
import {scaleZoom, zoomScale} from '../transform_helper';
import {degreesToRadians} from '../../util/util';
import {projectToWorldCoordinates, unprojectFromWorldCoordinates} from './mercator_utils';

// We need to be able to call this directly from camera.ts
export function handleJumpToCenterZoomMercator(tr: ITransform, options: { zoom?: number; apparentZoom?: number; center?: LngLatLike }): void {
    // Mercator zoom & center handling.
    const optionsZoom = typeof options.zoom === 'number';
    const optionsApparentZoom = typeof options.apparentZoom === 'number';

    const zoom = optionsZoom ? +options.zoom : (optionsApparentZoom ? +options.apparentZoom : tr.zoom);
    if (tr.zoom !== zoom) {
        tr.setZoom(+options.zoom);
    }

    if (options.center !== undefined) {
        tr.setCenter(LngLat.convert(options.center));
    }
}

/**
 * @internal
 */
export class MercatorCameraHelper implements ICameraHelper {
    get useGlobeControls(): boolean { return false; }

    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    } {
        return {
            easingOffset: pan,
            easingCenter: transform.center,
        };
    }

    handleMapControlsPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void {
        if (deltas.bearingDelta) tr.setBearing(tr.bearing + deltas.bearingDelta);
        if (deltas.pitchDelta) tr.setPitch(tr.pitch + deltas.pitchDelta);
        if (deltas.zoomDelta) tr.setZoom(tr.zoom + deltas.zoomDelta);
    }

    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat): void {
        tr.setLocationAtPoint(preZoomAroundLoc, deltas.around);
    }

    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: IReadonlyTransform) {
        const edgePadding = tr.padding;

        // Consider all corners of the rotated bounding box derived from the given points
        // when find the camera position that fits the given points.

        const nwWorld = projectToWorldCoordinates(tr.worldSize, bounds.getNorthWest());
        const neWorld = projectToWorldCoordinates(tr.worldSize, bounds.getNorthEast());
        const seWorld = projectToWorldCoordinates(tr.worldSize, bounds.getSouthEast());
        const swWorld = projectToWorldCoordinates(tr.worldSize, bounds.getSouthWest());

        const bearingRadians = degreesToRadians(-bearing);

        const nwRotatedWorld = nwWorld.rotate(bearingRadians);
        const neRotatedWorld = neWorld.rotate(bearingRadians);
        const seRotatedWorld = seWorld.rotate(bearingRadians);
        const swRotatedWorld = swWorld.rotate(bearingRadians);

        const upperRight = new Point(
            Math.max(nwRotatedWorld.x, neRotatedWorld.x, swRotatedWorld.x, seRotatedWorld.x),
            Math.max(nwRotatedWorld.y, neRotatedWorld.y, swRotatedWorld.y, seRotatedWorld.y)
        );

        const lowerLeft = new Point(
            Math.min(nwRotatedWorld.x, neRotatedWorld.x, swRotatedWorld.x, seRotatedWorld.x),
            Math.min(nwRotatedWorld.y, neRotatedWorld.y, swRotatedWorld.y, seRotatedWorld.y)
        );

        // Calculate zoom: consider the original bbox and padding.
        const size = upperRight.sub(lowerLeft);

        const availableWidth = (tr.width - (edgePadding.left + edgePadding.right + padding.left + padding.right));
        const availableHeight = (tr.height - (edgePadding.top + edgePadding.bottom + padding.top + padding.bottom));
        const scaleX = availableWidth / size.x;
        const scaleY = availableHeight / size.y;

        if (scaleY < 0 || scaleX < 0) {
            cameraBoundsWarning();
            return undefined;
        }

        const zoom = Math.min(scaleZoom(tr.scale * Math.min(scaleX, scaleY)), options.maxZoom);

        // Calculate center: apply the zoom, the configured offset, as well as offset that exists as a result of padding.
        const offset = Point.convert(options.offset);
        const paddingOffsetX = (padding.left - padding.right) / 2;
        const paddingOffsetY = (padding.top - padding.bottom) / 2;
        const paddingOffset = new Point(paddingOffsetX, paddingOffsetY);
        const rotatedPaddingOffset = paddingOffset.rotate(degreesToRadians(bearing));
        const offsetAtInitialZoom = offset.add(rotatedPaddingOffset);
        const offsetAtFinalZoom = offsetAtInitialZoom.mult(tr.scale / zoomScale(zoom));

        const center = unprojectFromWorldCoordinates(
            tr.worldSize,
            // either world diagonal can be used (NW-SE or NE-SW)
            nwWorld.add(seWorld).div(2).sub(offsetAtFinalZoom)
        );

        const result = {
            center,
            zoom,
            bearing
        };

        return result;
    }

    handleJumpToCenterZoom(tr: ITransform, options: { zoom?: number; apparentZoom?: number; center?: LngLatLike }): void {
        handleJumpToCenterZoomMercator(tr, options);
    }
}
