import {interpolates} from '@maplibre/maplibre-gl-style-spec';

import {Anchor} from '../symbol/anchor';
import {checkMaxAngle} from './check_max_angle';
import {tileCoordinatesToLocation, lngLatToTileCoordinates} from '../geo/projection/mercator_utils';

import type Point from '@mapbox/point-geometry';
import type {Shaping, PositionedIcon} from './shaping';
import type {CanonicalTileID} from '../source/tile_id';
import { LngLat } from '../geo/lng_lat';

export {getAnchors, getCenterAnchor};

function getLineLength(line: Array<Point>): number {
    let lineLength = 0;
    for (let k = 0; k < line.length - 1; k++) {
        lineLength += line[k].dist(line[k + 1]);
    }
    return lineLength;
}

function getLineLengthHaversine(
    line: Array<Point>,
    canonical: CanonicalTileID
): number {
    let lineLength = 0;
    for (let k = 0; k < line.length - 1; k++) {
        const a = tileCoordinatesToLocation(line[k].x, line[k].y, canonical),
            b = tileCoordinatesToLocation(line[k + 1].x, line[k + 1].y, canonical);
        lineLength += a.distanceTo(b);
    }
    return lineLength;
}

function getAngleWindowSize(
    shapedText: Shaping,
    glyphSize: number,
    boxScale: number
): number {
    return shapedText ?
        3 / 5 * glyphSize * boxScale :
        0;
}

function getShapedLabelLength(shapedText?: Shaping | null, shapedIcon?: PositionedIcon | null): number {
    return Math.max(
        shapedText ? shapedText.right - shapedText.left : 0,
        shapedIcon ? shapedIcon.right - shapedIcon.left : 0);
}

function getCenterAnchor(line: Array<Point>,
    maxAngle: number,
    shapedText: Shaping,
    shapedIcon: PositionedIcon,
    glyphSize: number,
    boxScale: number,
    textProjection: boolean,
    canonical: CanonicalTileID) {
    const angleWindowSize = getAngleWindowSize(shapedText, glyphSize, boxScale);
    const labelLength = getShapedLabelLength(shapedText, shapedIcon) * boxScale;

    let prevDistance = 0;
    const centerDistance = textProjection ? getLineLengthHaversine(line, canonical) / 2 : getLineLength(line) / 2;

    for (let i = 0; i < line.length - 1; i++) {

        let a = null, b = null;
        let segmentDistance = 0;
        if (textProjection) {
            a = tileCoordinatesToLocation(line[i].x, line[i].y, canonical);
            b = tileCoordinatesToLocation(line[i + 1].x, line[i + 1].y, canonical);
            segmentDistance = a.distanceTo(b);
            a.x = a.lng;
            a.y = a.lat;
            b.x = b.lng;
            b.y = b.lat;
        } else {
            a = line[i];
            b = line[i + 1];
            segmentDistance = a.dist(b);
        }

        if (prevDistance + segmentDistance > centerDistance) {
            // The center is on this segment
            const t = (centerDistance - prevDistance) / segmentDistance;
            let x = interpolates.number(a.x, b.x, t);
            let y = interpolates.number(a.y, b.y, t);
            if (textProjection) {
                const tileCoord = lngLatToTileCoordinates(new LngLat(x, y), canonical);
                x = tileCoord.tileX;
                y = tileCoord.tileY;
                a = line[i];
                b = line[i + 1];
            }
            const anchor = new Anchor(x, y, b.angleTo(a), i);
            anchor._round();
            if (!angleWindowSize || checkMaxAngle(line, anchor, labelLength, angleWindowSize, maxAngle)) {
                return anchor;
            } else {
                return;
            }
        }

        prevDistance += segmentDistance;
    }
}

function getAnchors(line: Array<Point>,
    spacing: number,
    maxAngle: number,
    shapedText: Shaping,
    shapedIcon: PositionedIcon,
    glyphSize: number,
    boxScale: number,
    overscaling: number,
    tileExtent: number) {

    // Resample a line to get anchor points for labels and check that each
    // potential label passes text-max-angle check and has enough room to fit
    // on the line.

    const angleWindowSize = getAngleWindowSize(shapedText, glyphSize, boxScale);
    const shapedLabelLength = getShapedLabelLength(shapedText, shapedIcon);
    const labelLength = shapedLabelLength * boxScale;

    // Is the line continued from outside the tile boundary?
    const isLineContinued = line[0].x === 0 || line[0].x === tileExtent || line[0].y === 0 || line[0].y === tileExtent;

    // Is the label long, relative to the spacing?
    // If so, adjust the spacing so there is always a minimum space of `spacing / 4` between label edges.
    if (spacing - labelLength < spacing / 4) {
        spacing = labelLength + spacing / 4;
    }

    // Offset the first anchor by:
    // Either half the label length plus a fixed extra offset if the line is not continued
    // Or half the spacing if the line is continued.

    // For non-continued lines, add a bit of fixed extra offset to avoid collisions at T intersections.
    const fixedExtraOffset = glyphSize * 2;

    const offset = !isLineContinued ?
        ((shapedLabelLength / 2 + fixedExtraOffset) * boxScale * overscaling) % spacing :
        (spacing / 2 * overscaling) % spacing;

    return resample(line, offset, spacing, angleWindowSize, maxAngle, labelLength, isLineContinued, false, tileExtent);
}

function resample(line, offset, spacing, angleWindowSize, maxAngle, labelLength, isLineContinued, placeAtMiddle, tileExtent) {

    const halfLabelLength = labelLength / 2;
    const lineLength = getLineLength(line);

    let distance = 0,
        markedDistance = offset - spacing;

    let anchors = [];

    for (let i = 0; i < line.length - 1; i++) {

        const a = line[i],
            b = line[i + 1];

        const segmentDist = a.dist(b),
            angle = b.angleTo(a);

        while (markedDistance + spacing < distance + segmentDist) {
            markedDistance += spacing;

            const t = (markedDistance - distance) / segmentDist,
                x = interpolates.number(a.x, b.x, t),
                y = interpolates.number(a.y, b.y, t);

            // Check that the point is within the tile boundaries and that
            // the label would fit before the beginning and end of the line
            // if placed at this point.
            if (x >= 0 && x < tileExtent && y >= 0 && y < tileExtent &&
                    markedDistance - halfLabelLength >= 0 &&
                    markedDistance + halfLabelLength <= lineLength) {
                const anchor = new Anchor(x, y, angle, i);
                anchor._round();

                if (!angleWindowSize || checkMaxAngle(line, anchor, labelLength, angleWindowSize, maxAngle)) {
                    anchors.push(anchor);
                }
            }
        }

        distance += segmentDist;
    }

    if (!placeAtMiddle && !anchors.length && !isLineContinued) {
        // The first attempt at finding anchors at which labels can be placed failed.
        // Try again, but this time just try placing one anchor at the middle of the line.
        // This has the most effect for short lines in overscaled tiles, since the
        // initial offset used in overscaled tiles is calculated to align labels with positions in
        // parent tiles instead of placing the label as close to the beginning as possible.
        anchors = resample(line, distance / 2, spacing, angleWindowSize, maxAngle, labelLength, isLineContinued, true, tileExtent);
    }

    return anchors;
}
