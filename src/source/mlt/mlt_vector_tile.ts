import Point from '@mapbox/point-geometry';
import {type VectorTile, type VectorTileFeature, type VectorTileLayer} from '@mapbox/vector-tile';

type PublicPart<T> = {[K in keyof T]: T[K]};

// HM TODO: replace these when there's a mlt package published.
class FeatureTable {
    name: string;
    numFeatures: number;
    *[Symbol.iterator](): Iterator<GeoJSON.Feature> {
    }
}

function decodeTile(_data: Uint8Array): FeatureTable[] {
    return [];
}

class MLTVectorTileFeature implements PublicPart<VectorTileFeature> {
    _featureData: GeoJSON.Feature;
    properties: {[_: string]: any};
    type: VectorTileFeature['type'];
    extent: VectorTileFeature['extent'];
    id: VectorTileFeature['id'];

    constructor(feature: GeoJSON.Feature) {
        this._featureData = feature;
        this.properties = this._featureData.properties || {};
        this.type = this._featureData.geometry ? (this._featureData.geometry.type === 'Point' ? 1 : this._featureData.geometry.type === 'LineString' ? 2 : this._featureData.geometry.type === 'Polygon' ? 3 : 0) : 0;
        this.extent = 4096;
        this.id = Number(this._featureData.id);
    }

    toGeoJSON(_x: number, _y: number, _z: number): GeoJSON.Feature {
        return this._featureData;
    }

    loadGeometry(): Point[][] {
        switch (this._featureData.geometry?.type) {
            case 'Point':
                return [[new Point((this._featureData.geometry.coordinates)[0], (this._featureData.geometry.coordinates)[1])]];
            case 'MultiPoint':
                return (this._featureData.geometry.coordinates).map(coord => [new Point(coord[0], coord[1])]);
            case 'LineString':
                return [(this._featureData.geometry.coordinates).map(coord => new Point(coord[0], coord[1]))];
            case 'MultiLineString':
                return (this._featureData.geometry.coordinates).map(line => line.map(coord => new Point(coord[0], coord[1])));
            case 'Polygon':
                return (this._featureData.geometry.coordinates).map(ring => ring.map(coord => new Point(coord[0], coord[1])));
            case 'MultiPolygon':
                return (this._featureData.geometry.coordinates).map(polygon => polygon.flatMap(ring => ring.map(coord => new Point(coord[0], coord[1]))));
            default:
                return [];
        }
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

    constructor(featureTable: FeatureTable) {
        this.featureTable = featureTable;
        this.name = featureTable.name;
        this.length = featureTable.numFeatures;
    }

    feature(i: number): VectorTileFeature {
        return new MLTVectorTileFeature(this.featureTable[i]) as unknown as VectorTileFeature;
    }
}

export class MLTVectorTile implements VectorTile {
    layers: Record<string, VectorTileLayer> = {};

    constructor(buffer: ArrayBuffer) {
        const features = decodeTile(new Uint8Array(buffer));
        this.layers = features.reduce((acc, f) => ({...acc, [f.name]: new MLTVectorTileLayer(f)}), {});
    }

}