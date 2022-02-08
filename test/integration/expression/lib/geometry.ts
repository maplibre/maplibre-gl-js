
import MercatorCoordinate from '../../../../src/geo/mercator_coordinate';
import Point from '@mapbox/point-geometry';
import {CanonicalTileID} from '../../../../src/source/tile_id';
import {LngLatLike} from '../../../../src/geo/lng_lat';

function getPoint(coord: LngLatLike, canonical: CanonicalTileID): Point {
    const p: Point = canonical.getTilePoint(MercatorCoordinate.fromLngLat({lng: coord[0], lat: coord[1]}, 0));
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
    return p;
}

function convertPoint(coord: LngLatLike, canonical: CanonicalTileID): Point[] {
    return [getPoint(coord, canonical)];
}

function convertPoints(coords: LngLatLike[], canonical: CanonicalTileID): Point[][] {
    const o: Point[][] = [];
    for (let i = 0; i < coords.length; i++) {
        o.push(convertPoint(coords[i], canonical));
    }

    return o;
}

function convertLine(line: LngLatLike[], canonical: CanonicalTileID): Point[] {
    const l: Point[] = [];
    for (let i = 0; i < line.length; i++) {
        l.push(getPoint(line[i], canonical));
    }
    return l;
}

function convertLines(lines: LngLatLike[][], canonical: CanonicalTileID): Point[][] {
    const l: Point[][] = [];
    for (let i = 0; i < lines.length; i++) {
        l.push(convertLine(lines[i], canonical));
    }
    return l;
}

export function getGeometry(feature, geometry, canonical: CanonicalTileID) {
    if (geometry.coordinates) {
        const coords = geometry.coordinates;
        const type = geometry.type;
        feature.type = type;
        feature.geometry = [];
        if (type === 'Point') {
            feature.geometry.push(convertPoint(coords, canonical));
        } else if (type === 'MultiPoint') {
            feature.type = 'Point';
            feature.geometry.push(...convertPoints(coords, canonical));
        } else if (type === 'LineString') {
            feature.geometry.push(convertLine(coords, canonical));
        } else if (type === 'MultiLineString') {
            feature.type = 'LineString';
            feature.geometry.push(...convertLines(coords, canonical));
        } else if (type === 'Polygon') {
            feature.geometry.push(...convertLines(coords, canonical));
        } else if (type === 'MultiPolygon') {
            feature.type = 'Polygon';
            for (let i = 0; i < coords.length; i++) {
                const polygon = [];
                polygon.push(...convertLines(coords[i], canonical));
                feature.geometry.push(polygon);
            }
        }
    }
}
