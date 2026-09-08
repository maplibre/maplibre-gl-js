import {test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {GeoJSONVT} from '@maplibre/geojson-vt';
import {EXTENT} from '../data/extent.ts';
import {mercatorYfromLat} from '../geo/mercator_coordinate.ts';
import {LineBucket} from '../data/bucket/line_bucket.ts';
import {LineStyleLayer} from '../style/style_layer/line_style_layer.ts';
import {SubdivisionGranularitySetting} from '../render/subdivision_granularity_settings.ts';
import {buildTaperRegistry, annotateGeoJSONTileFeature} from './geojson_taper.ts';
import type {CanonicalTileID} from '../tile/tile_id.ts';

function makeSCurve() {
    const L0 = 13.34, L1 = 13.56, BASE = 52.41, AMP = 0.007;
    const coords: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        coords.push([L0 + (L1 - L0) * t, BASE + AMP * Math.sin(2 * Math.PI * t)]);
    }
    return {coords, L0, L1};
}

function makeBucket() {
    const styleLayer = new LineStyleLayer({id: 'dbg', type: 'line', layout: {}, paint: {'line-width-start': 3, 'line-width-end': 40}} as any, undefined);
    styleLayer.recalculate({zoom: 0, zoomHistory: {} as any} as any, []);
    return new LineBucket({
        index: 0,
        layers: [styleLayer],
        zoom: 12,
        pixelRatio: 1,
        overscaling: 1,
        collisionBoxArray: {} as any,
        sourceLayerIndex: 0,
        sourceID: 'dbg'
    } as any);
}

test('real z13 piece: annotation + bucket emission stay consistent (start/end mode)', () => {
    const {coords, L0, L1} = makeSCurve();
    const data = {
        type: 'FeatureCollection',
        features: [{type: 'Feature', properties: {widths: [3, 20, 40]}, geometry: {type: 'LineString', coordinates: coords}}]
    };
    const registry = buildTaperRegistry(data as any);
    const index = new GeoJSONVT(data as any, {extent: EXTENT, buffer: 256, maxZoom: 14, tolerance: 0});

    const z = 13;
    const x = Math.floor(((13.5352 + 180) / 360) * (1 << z));
    const y = Math.floor(mercatorYfromLat(52.41) * (1 << z));
    const canonical = {z, x, y} as unknown as CanonicalTileID;
    const tile = index.getTile(z, x, y);

    // (1) Annotation prüfen
    annotateGeoJSONTileFeature(tile.features[0] as any, canonical, registry);
    const feat = tile.features[0] as {_taper?: {pieceKnots: number[][]; profiles: {}}, geometry: unknown};
    console.log('ANNOTATION pieceKnots:', JSON.stringify(feat._taper?.pieceKnots.map(k => k.map(v => +v.toFixed(4)))));

    // (2) Bucket-Emission mit exakt diesem Piece (start/end-Modus)
    const bucket = makeBucket();
    const rawLines = feat.geometry as [number, number][][];
    const geometry = rawLines.map((line: [number, number][]) =>
        line.map((p) => new Point(p[0], p[1])));
    const bucketFeature = {
        type: 2, properties: {widths: [3, 20, 40]}, _taper: feat._taper, id: undefined,
        index: 0, sourceLayerIndex: 0, geometry, patterns: {}, dashes: {}, sortKey: undefined
    };
    bucket.addFeature(bucketFeature as any, geometry, 0, canonical, {}, {}, SubdivisionGranularitySetting.noSubdivision);
    const values = bucket.layoutTaperArray.float32.subarray(0, bucket.layoutTaperArray.length);
    const out: number[] = [];
    for (const v of values) if (out.length === 0 || out[out.length - 1] !== v) out.push(+v.toFixed(4));
    console.log('EMITTIERT:', JSON.stringify(out));
    expect(out[0]).toBeGreaterThan(0.85);
    expect(out[out.length - 1]).toBeCloseTo(1, 3);
});
