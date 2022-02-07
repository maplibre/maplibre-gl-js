
import MercatorCoordinate from '../../../../src/geo/mercator_coordinate';
import Point from '@mapbox/point-geometry';

function getPoint(coord, canonical) {
    const p: Point = canonical.getTilePoint(MercatorCoordinate.fromLngLat({lng: coord[0], lat: coord[1]}, 0));
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
    return p;
}

function convertPoint(coord, canonical, out) {
    out.push([getPoint(coord, canonical)]);
}

function convertPoints(coords, canonical, out) {
    for (let i = 0; i < coords.length; i++) {
        convertPoint(coords[i], canonical, out);
    }
}

function convertLine(line, canonical, out) {
    const l = [];
    for (let i = 0; i < line.length; i++) {
        l.push(getPoint(line[i], canonical));
    }
    out.push(l);
}

function convertLines(lines, canonical, out) {
    for (let i = 0; i < lines.length; i++) {
        convertLine(lines[i], canonical, out);
    }
}

export function getGeometry(feature, geometry, canonical) {
    if (geometry.coordinates) {
        const coords = geometry.coordinates;
        const type = geometry.type;
        feature.type = type;
        feature.geometry = [];
        if (type === 'Point') {
            convertPoint(coords, canonical, feature.geometry);
        } else if (type === 'MultiPoint') {
            feature.type = 'Point';
            convertPoints(coords, canonical, feature.geometry);
        } else if (type === 'LineString') {
            convertLine(coords, canonical, feature.geometry);
        } else if (type === 'MultiLineString') {
            feature.type = 'LineString';
            convertLines(coords, canonical, feature.geometry);
        } else if (type === 'Polygon') {
            convertLines(coords, canonical, feature.geometry);
        } else if (type === 'MultiPolygon') {
            feature.type = 'Polygon';
            for (let i = 0; i < coords.length; i++) {
                const polygon = [];
                convertLines(coords[i], canonical, polygon);
                feature.geometry.push(polygon);
            }
        }
    }
}
