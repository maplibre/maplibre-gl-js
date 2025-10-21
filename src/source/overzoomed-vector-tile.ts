import {type VectorTile, VectorTileFeature, VectorTileLayer} from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import Point from '@mapbox/point-geometry';
import {fromVectorTileJs} from '@maplibre/vt-pbf';
import {clipGeometry} from '../symbol/clip_line';
import type {LoadVectorTileResult} from './vector_tile_worker_source';
import type {CanonicalTileID} from './tile_id';

class OverzoomedFeatureWrapper extends VectorTileFeature {
    pointsArray: Point[][];

    constructor(type: 0 | 1 | 2 | 3, geometry: Point[][], properties: any, id: number, extent: number) {
        super(new Protobuf(), 0, extent, [], []);
        this.type = type;
        this.properties = properties ? properties : {};
        this.extent = extent;
        this.pointsArray = geometry;
        this.id = id;
    }

    loadGeometry() {
        // Clone the geometry and ensure all points are Point instances
        return this.pointsArray.map(ring => 
            ring.map(point => new Point(point.x, point.y))
        );
    }
}

class OverzoomedTileLayer extends VectorTileLayer {
    private _myFeatures: OverzoomedFeatureWrapper[];
    name: string;
    extent: number;
    version: number = 2;
    length: number;

    constructor(features: OverzoomedFeatureWrapper[], layerName: string, extent: number) {
        super(new Protobuf());
        this._myFeatures = features;
        this.name = layerName;
        this.length = features.length;
        this.extent = extent;
    }

    feature(i: number): VectorTileFeature {
        return this._myFeatures[i];
    }
}

export class OverzoomedVectorTile implements VectorTile {
    layers: Record<string, VectorTileLayer> = {};

    addLayer(layer: OverzoomedTileLayer) {
        this.layers[layer.name] = layer;
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

/**
 * This function slices a source tile layer into an overzoomed tile layer for a target tile ID.
 * @param sourceLayer - the source tile layer to slice
 * @param maxZoomTileID - the maximum zoom tile ID
 * @param targetTileID - the target tile ID
 * @returns - the overzoomed tile layer
 */
export function sliceTileLayer(sourceLayer: VectorTileLayer, maxZoomTileID: CanonicalTileID, targetTileID: CanonicalTileID): OverzoomedTileLayer {
    const {extent} = sourceLayer;
    const dz = targetTileID.z - maxZoomTileID.z;
    const scale = Math.pow(2, dz);
    
    // Calculate the target tile's position within the source tile in target coordinate space
    // This ensures all tiles share the same coordinate system
    const offsetX = (targetTileID.x - maxZoomTileID.x * scale) * extent;
    const offsetY = (targetTileID.y - maxZoomTileID.y * scale) * extent;

    const featureWrappers: OverzoomedFeatureWrapper[] = [];
    for (let index = 0; index < sourceLayer.length; index++) {
        const feature: VectorTileFeature = sourceLayer.feature(index);
        let geometry = feature.loadGeometry();
        
        // Transform all coordinates to target tile space
        for (const ring of geometry) {
            for (const point of ring) {
                point.x = point.x * scale - offsetX;
                point.y = point.y * scale - offsetY;
            }
        }
        
        const buffer = 128;
        geometry = clipGeometry(geometry, feature.type, -buffer, -buffer, extent + buffer, extent + buffer);
        if (geometry.length === 0) {
            continue;
        }
        
        featureWrappers.push(new OverzoomedFeatureWrapper(
            feature.type,
            geometry,
            feature.properties,
            feature.id,
            extent
        ));
    }
    return new OverzoomedTileLayer(featureWrappers, sourceLayer.name, extent);
}