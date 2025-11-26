import type Point from '@mapbox/point-geometry';
import {classifyRings} from '@mapbox/vector-tile';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {VectorTileFeatureLike} from '@maplibre/vt-pbf';

/**
 * A helper for type to omit a property from a type
 */
export type DistributiveKeys<T> = T extends T ? keyof T : never;
/**
 * A helper for type to omit a property from a type
 */
export type DistributiveOmit<T, K extends DistributiveKeys<T>> = T extends unknown
    ? Omit<T, K>
    : never;

/**
 * An extended geojson feature used by the events to return data to the listener
 */
export type MapGeoJSONFeature = GeoJSONFeature & {
    layer: DistributiveOmit<LayerSpecification, 'source'> & {source: string};
    source: string;
    sourceLayer?: string;
    state: { [key: string]: any };
};

/**
 * A geojson feature
 */
export class GeoJSONFeature {
    type: 'Feature';
    _geometry: GeoJSON.Geometry;
    properties: { [name: string]: any };
    id: number | string | undefined;
    x: number;
    y: number;
    z: number;

    _vectorTileFeature: VectorTileFeatureLike;

    constructor(vectorTileFeature: VectorTileFeatureLike, z: number, x: number, y: number, id: string | number | undefined) {
        this.type = 'Feature';

        this._vectorTileFeature = vectorTileFeature;
        this.x = x;
        this.y = y;
        this.z = z;

        this.properties = vectorTileFeature.properties;
        this.id = id;
    }

    // Copied from https://github.com/mapbox/vector-tile-js/blob/f1457ee47d0a261e6246d68c959fbd12bf56aeeb/index.js
    get geometry(): GeoJSON.Geometry {
        if (this._geometry) return this._geometry;

        const feature = this._vectorTileFeature;

        const size = feature.extent * Math.pow(2, this.z),
            x0 = feature.extent * this.x,
            y0 = feature.extent * this.y,
            vtCoords = feature.loadGeometry();

        function projectPoint(p: Point) {
            return [
                (p.x + x0) * 360 / size - 180,
                360 / Math.PI * Math.atan(Math.exp((1 - (p.y + y0) * 2 / size) * Math.PI)) - 90
            ];
        }

        function projectLine(line: Point[]) {
            return line.map(projectPoint);
        }

        if (feature.type === 1) {
            const points = [];
            for (const line of vtCoords) {
                points.push(line[0]);
            }
            const coordinates = projectLine(points);
            this._geometry = points.length === 1 ?
                {type: 'Point', coordinates: coordinates[0]} :
                {type: 'MultiPoint', coordinates};

        } else if (feature.type === 2) {

            const coordinates = vtCoords.map(projectLine);
            this._geometry = coordinates.length === 1 ?
                {type: 'LineString', coordinates: coordinates[0]} :
                {type: 'MultiLineString', coordinates};

        } else if (feature.type === 3) {
            const polygons = classifyRings(vtCoords);
            const coordinates = [];
            for (const polygon of polygons) {
                coordinates.push(polygon.map(projectLine));
            }
            this._geometry = coordinates.length === 1 ?
                {type: 'Polygon', coordinates: coordinates[0]} :
                {type: 'MultiPolygon', coordinates};
        } else {

            throw new Error('unknown feature type');
        }

        return this._geometry;
    }

    set geometry(g: GeoJSON.Geometry) {
        this._geometry = g;
    }

    toJSON() {
        const json: any = {
            geometry: this.geometry
        };
        for (const i in this) {
            if (i === '_geometry' || i === '_vectorTileFeature') continue;
            json[i] = (this)[i];
        }
        return json;
    }
}
