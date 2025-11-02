import Point from '@mapbox/point-geometry';
import {type VectorTile, type VectorTileFeature, type VectorTileLayer} from '@mapbox/vector-tile';
import {classifyRings} from '@maplibre/maplibre-gl-style-spec';
import {type FeatureTable, decodeTile, type Feature as MLTFeature, GEOMETRY_TYPE} from '@maplibre/mlt';

type PublicPart<T> = {[K in keyof T]: T[K]};

class MLTVectorTileFeature implements PublicPart<VectorTileFeature> {
    _featureData: MLTFeature;
    properties: {[_: string]: any};
    type: VectorTileFeature['type'];
    extent: VectorTileFeature['extent'];
    id: VectorTileFeature['id'];

    constructor(feature: MLTFeature, extent: number) {
        this._featureData = feature;
        this.properties = this._featureData.properties || {};
        switch (this._featureData.geometry?.type) {
            case GEOMETRY_TYPE.POINT:
            case GEOMETRY_TYPE.MULTIPOINT:
                this.type = 1;
                break;
            case GEOMETRY_TYPE.LINESTRING:
            case GEOMETRY_TYPE.MULTILINESTRING:
                this.type = 2;
                break;
            case GEOMETRY_TYPE.POLYGON:
            case GEOMETRY_TYPE.MULTIPOLYGON:
                this.type = 3;
                break;
            default:
                this.type = 0;
        };
        this.extent = extent;
        this.id = Number(this._featureData.id);
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

    toGeoJSON(x: number, y: number, z: number): GeoJSON.Feature {
        // Copied from https://github.com/mapbox/vector-tile-js/blob/f1457ee47d0a261e6246d68c959fbd12bf56aeeb/index.js
        const size = this.extent * Math.pow(2, z);
        const x0 = this.extent * x;
        const y0 = this.extent * y;
        const vtCoords = this.loadGeometry();

        let geometry: GeoJSON.Geometry;

        switch (this.type) {
            case 1: {
                const points = [];
                for (const line of vtCoords) {
                    points.push(line[0]);
                }
                const coordinates = this.projectLine(points, x0, y0, size);
                geometry = points.length === 1 ?
                    {type: 'Point', coordinates: coordinates[0]} :
                    {type: 'MultiPoint', coordinates};
                break;
            }
            case 2: {
                const coordinates = vtCoords.map(coord => this.projectLine(coord, x0, y0, size));
                geometry = coordinates.length === 1 ?
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
                geometry = coordinates.length === 1 ?
                    {type: 'Polygon', coordinates: coordinates[0]} :
                    {type: 'MultiPolygon', coordinates};
                break;
            }
            default: 
                throw new Error(`unknown feature type: ${this.type}`);
        }

        const result: GeoJSON.Feature = {
            type: 'Feature',
            geometry,
            properties: this.properties
        };

        if (this.id != null) {
            result.id = this.id;
        }

        return result;
    }

    loadGeometry(): Point[][] {
        const points: Point[][] = [];
        for (const ring of this._featureData.geometry.coordinates) {
            const pointRing: Point[] = [];
            for (const coord of ring) {
                pointRing.push(new Point(coord.x, coord.y));
            }
            points.push(pointRing);
        }
        return points;
    }
    bbox(): number[] {
        return [0, 0, 0, 0];
    }
}

class MLTVectorTileLayer implements PublicPart<VectorTileLayer> {
    featureTable: FeatureTable;
    name: string;
    length: number;
    version: number;
    extent: number;
    features: MLTFeature[] = [];
    
    constructor(featureTable: FeatureTable) {
        this.featureTable = featureTable;
        this.name = featureTable.name;
        this.extent = featureTable.extent;
        this.version = 2;
        this.features = featureTable.getFeatures();
        this.length = this.features.length;
    }

    feature(i: number): VectorTileFeature {
        return new MLTVectorTileFeature(this.features[i], this.extent) as unknown as VectorTileFeature;
    }
}

export class MLTVectorTile implements VectorTile {
    layers: Record<string, VectorTileLayer> = {};

    constructor(buffer: ArrayBuffer) {
        const features = decodeTile(new Uint8Array(buffer));
        this.layers = features.reduce((acc, f) => ({...acc, [f.name]: new MLTVectorTileLayer(f)}), {});
    }
}