import Point from '@mapbox/point-geometry';
import {LngLat, LngLatLike} from '../lng_lat';
import {IReadonlyTransform, ITransform} from '../transform_interface';
import {cameraBoundsWarning, CameraForBoxAndBearingHandlerResult, EaseToHandlerResult, EaseToHandlerOptions, FlyToHandlerResult, FlyToHandlerOptions, ICameraHelper, MapControlsDeltas} from './camera_helper';
import {CameraForBoundsOptions} from '../../ui/camera';
import {PaddingOptions} from '../edge_insets';
import {LngLatBounds} from '../lng_lat_bounds';
import {normalizeCenter, scaleZoom, zoomScale} from '../transform_helper';
import {degreesToRadians} from '../../util/util';
import {projectToWorldCoordinates, unprojectFromWorldCoordinates} from './mercator_utils';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';

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

    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: IReadonlyTransform): CameraForBoxAndBearingHandlerResult {
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

    handleJumpToCenterZoom(tr: ITransform, options: { zoom?: number; center?: LngLatLike }): void {
        // Mercator zoom & center handling.
        const optionsZoom = typeof options.zoom !== 'undefined';

        const zoom = optionsZoom ? +options.zoom : tr.zoom;
        if (tr.zoom !== zoom) {
            tr.setZoom(+options.zoom);
        }

        if (options.center !== undefined) {
            tr.setCenter(LngLat.convert(options.center));
        }
    }

    handleEaseTo(tr: ITransform, options: EaseToHandlerOptions): EaseToHandlerResult {
        const startZoom = tr.zoom;
        const startBearing = tr.bearing;
        const startPitch = tr.pitch;
        const startPadding = tr.padding;

        const optionsZoom = typeof options.zoom !== 'undefined';

        const doPadding = !tr.isPaddingEqual(options.padding);

        let isZooming = false;

        const zoom = optionsZoom ? +options.zoom : tr.zoom;

        let pointAtOffset = tr.centerPoint.add(options.offsetAsPoint);
        const locationAtOffset = tr.screenPointToLocation(pointAtOffset);
        const {center, zoom: endZoom} = tr.getConstrained(
            LngLat.convert(options.center || locationAtOffset),
            zoom ?? startZoom
        );
        normalizeCenter(tr, center);

        const from = projectToWorldCoordinates(tr.worldSize, locationAtOffset);
        const delta = projectToWorldCoordinates(tr.worldSize, center).sub(from);

        const finalScale = zoomScale(endZoom - startZoom);
        isZooming = (endZoom !== startZoom);

        const easeFunc = (k: number) => {
            if (isZooming) {
                tr.setZoom(interpolates.number(startZoom, endZoom, k));
            }
            if (startBearing !== options.bearing) {
                tr.setBearing(interpolates.number(startBearing, options.bearing, k));
            }
            if (startPitch !== options.pitch) {
                tr.setPitch(interpolates.number(startPitch, options.pitch, k));
            }
            if (doPadding) {
                tr.interpolatePadding(startPadding, options.padding, k);
                // When padding is being applied, Transform#centerPoint is changing continuously,
                // thus we need to recalculate offsetPoint every frame
                pointAtOffset = tr.centerPoint.add(options.offsetAsPoint);
            }

            if (options.around) {
                tr.setLocationAtPoint(options.around, options.aroundPoint);
            } else {
                const scale = zoomScale(tr.zoom - startZoom);
                const base = endZoom > startZoom ?
                    Math.min(2, finalScale) :
                    Math.max(0.5, finalScale);
                const speedup = Math.pow(base, 1 - k);
                const newCenter = unprojectFromWorldCoordinates(tr.worldSize, from.add(delta.mult(k * speedup)).mult(scale));
                tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);
            }
        };

        return {
            easeFunc,
            isZooming,
            elevationCenter: center,
        };
    }

    handleFlyTo(tr: ITransform, options: FlyToHandlerOptions): FlyToHandlerResult {
        const optionsZoom = typeof options.zoom !== 'undefined';

        const startZoom = tr.zoom;

        // Obtain target center and zoom
        const constrained = tr.getConstrained(
            LngLat.convert(options.center || options.locationAtOffset),
            optionsZoom ? +options.zoom : startZoom
        );
        const targetCenter = constrained.center;
        const targetZoom = constrained.zoom;

        normalizeCenter(tr, targetCenter);

        const from = projectToWorldCoordinates(tr.worldSize, options.locationAtOffset);
        const delta = projectToWorldCoordinates(tr.worldSize, targetCenter).sub(from);

        const pixelPathLength = delta.mag();

        const scaleOfZoom = zoomScale(targetZoom - startZoom);

        const optionsMinZoom = typeof options.minZoom !== 'undefined';

        let scaleOfMinZoom: number;

        if (optionsMinZoom) {
            const minZoomPreConstrain = Math.min(+options.minZoom, startZoom, targetZoom);
            const minZoom = tr.getConstrained(targetCenter, minZoomPreConstrain).zoom;
            scaleOfMinZoom = zoomScale(minZoom - startZoom);
        }

        const easeFunc = (k: number, scale: number, centerFactor: number, pointAtOffset: Point) => {
            tr.setZoom(k === 1 ? targetZoom : startZoom + scaleZoom(scale));
            const newCenter = k === 1 ? targetCenter : unprojectFromWorldCoordinates(tr.worldSize, from.add(delta.mult(centerFactor)).mult(scale));
            tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);
        };

        return {
            easeFunc,
            scaleOfZoom,
            targetCenter,
            scaleOfMinZoom,
            pixelPathLength,
        };
    }
}
