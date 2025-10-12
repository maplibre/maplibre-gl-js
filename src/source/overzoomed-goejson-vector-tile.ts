import type geojsonvt from 'geojson-vt';
import {type Feature as GeoJSONVTFeature} from 'geojson-vt';
import {type VectorTile, VectorTileFeature, VectorTileLayer} from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import Point from '@mapbox/point-geometry';
import {fromVectorTileJs} from '@maplibre/vt-pbf';

import {EXTENT} from '../data/extent';
import {type LoadVectorTileResult} from './vector_tile_worker_source';

export type GeoJSONVT = ReturnType<typeof geojsonvt>;

class FeatureWrapper extends VectorTileFeature {
    feature: GeoJSONVTFeature;

    constructor(feature: GeoJSONVTFeature, extent: number) {
        super(new Protobuf(), 0, extent, [], []);
        this.feature = feature;
        this.type = feature.type;
        this.properties = feature.tags ? feature.tags : {};
    }

    loadGeometry() {
        const geometry = [];
         
        const rawGeo = this.feature.type === 1 ? [this.feature.geometry] : this.feature.geometry as any as GeoJSON.Geometry[][];
        for (const ring of rawGeo) {
            const newRing = [];
            for (const point of ring) {
                newRing.push(new Point(point[0], point[1]));
            }
            geometry.push(newRing);
        }
        return geometry;
    }
}

class GeoJSONWrapperLayer extends VectorTileLayer {
    private _myFeatures: GeoJSONVTFeature[];
    name: string;
    extent: number = EXTENT;
    version: number = 2;
    length: number;

    constructor(features: GeoJSONVTFeature[], layerName: string) {
        super(new Protobuf());
        this._myFeatures = features;
        this.name = layerName;
        this.length = features.length;
    }

    feature(i: number): VectorTileFeature {
        return new FeatureWrapper(this._myFeatures[i], this.extent);
    }
}

export class OverzoomedGeoJSONVectorTile implements VectorTile {
    layers: Record<string, VectorTileLayer> = {};

    addLayer(features: GeoJSONVTFeature[], layerName: string) {
        this.layers[layerName] = new GeoJSONWrapperLayer(features, layerName);
    }
}

/**
 * Encodes the virtual tile into binary vector tile form. 
 * This is a convenience that allows `FeatureIndex` to operate the same way across `VectorTileSource` and `GeoJSONSource` data.
 * @param virtualVectorTile - a VectorTile created from GeoJSON data using geojson-vt
 * @returns 
 */
export function toVirtualVectorTile(virtualVectorTile: VectorTile): LoadVectorTileResult {
    
    let pbf: Uint8Array = fromVectorTileJs(virtualVectorTile);
    if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
        pbf = new Uint8Array(pbf);  // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
    }
    
    return {
        vectorTile: virtualVectorTile,
        rawData: pbf.buffer
    };
}