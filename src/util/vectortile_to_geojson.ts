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
    _x: number;
    _y: number;
    _z: number;

    _vectorTileFeature: VectorTileFeatureLike;

    constructor(vectorTileFeature: VectorTileFeatureLike, z: number, x: number, y: number, id: string | number | undefined) {
        this.type = 'Feature';
        this._vectorTileFeature = vectorTileFeature;
        this._x = x;
        this._y = y;
        this._z = z;

        this.properties = vectorTileFeature.properties;
        this.id = id;
    }

    private projectPoint(p: Point, x0: number, y0: number, size: number): [number, number] {
        return [
            (p.x + x0) * 360 / size - 180,
            360 / Math.PI * Math.atan(Math.exp((1 - (p.y + y0) * 2 / size) * Math.PI)) - 90
        ];
    }

    private projectLine(line: Point[], x0: number, y0: number, size: number) {
        return line.map(p => this.projectPoint(p, x0, y0, size));
    }

    get geometry(): GeoJSON.Geometry {
        if (this._geometry) return this._geometry;

        const feature = this._vectorTileFeature;

        // Copied from https://github.com/mapbox/vector-tile-js/blob/f1457ee47d0a261e6246d68c959fbd12bf56aeeb/index.js
        const size = feature.extent * Math.pow(2, this._z);
        const x0 = feature.extent * this._x;
        const y0 = feature.extent * this._y;
        const vtCoords = feature.loadGeometry();

        switch (feature.type) {
            case 1: {
                const points = [];
                for (const line of vtCoords) {
                    points.push(line[0]);
                }
                const coordinates = this.projectLine(points, x0, y0, size);
                this._geometry = points.length === 1 ?
                    {type: 'Point', coordinates: coordinates[0]} :
                    {type: 'MultiPoint', coordinates};
                break;
            }
            case 2: {
                const coordinates = vtCoords.map(coord => this.projectLine(coord, x0, y0, size));
                this._geometry = coordinates.length === 1 ?
                    {type: 'LineString', coordinates: coordinates[0]} :
                    {type: 'MultiLineString', coordinates};
                break;
            }
            case 3: {
                const polygons = classifyRings(vtCoords);
                const coordinates = [];
                for (const polygon of polygons) {
                    coordinates.push(polygon.map(coord => this.projectLine(coord, x0, y0, size)));
                }
                this._geometry = coordinates.length === 1 ?
                    {type: 'Polygon', coordinates: coordinates[0]} :
                    {type: 'MultiPolygon', coordinates};
                break;
            }
            default:
                throw new Error(`unknown feature type: ${feature.type}`);
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
            if (i === '_geometry' || i === '_vectorTileFeature' || i === '_x' || i === '_y' || i === '_z') continue;
            json[i] = (this)[i];
        }
        return json;
    }
}
