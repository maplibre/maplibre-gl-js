import {describe, test, expect, vi, beforeAll} from 'vitest';
import {CollisionBoxArray} from '../../data/array_types.g.ts';
import {performSymbolLayout} from '../../symbol/symbol_layout.ts';
import {Placement} from '../../symbol/placement.ts';
import {CanonicalTileID, OverscaledTileID} from '../../tile/tile_id.ts';
import {Tile} from '../../tile/tile.ts';
import {CrossTileSymbolIndex} from '../../symbol/cross_tile_symbol_index.ts';
import {FeatureIndex} from '../../data/feature_index.ts';
import {createSymbolBucket, createSymbolIconBucket, createSymbolStyleLayer} from '../../../test/unit/lib/create_symbol_layer.ts';
import {RGBAImage} from '../../util/image.ts';
import {ImagePosition} from '../../render/image_atlas.ts';
import {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings.ts';
import {MercatorTransform} from '../../geo/projection/mercator_transform.ts';
import {createPopulateOptions, loadVectorTile} from '../../../test/unit/lib/tile.ts';
import {SymbolBucket} from './symbol_bucket.ts';
import glyphs from '../../../test/unit/assets/fontstack-glyphs.json' with {type: 'json'};

import type {BucketParameters, IndexedFeature, PopulateParameters} from '../bucket.ts';
import type {SymbolStyleLayer} from '../../style/style_layer/symbol_style_layer.ts';
import type {StyleImage} from '../../style/style_image.ts';
import type {GlyphMap} from '../../style/style_glyph.ts';

const collisionBoxArray = new CollisionBoxArray();
const transform = new MercatorTransform();
transform.resize(100, 100);

const glyphsByCluster = {
    'Test': {default: Object.fromEntries(
        Object.entries(glyphs).map(([codePoint, glyph]) => [String.fromCodePoint(Number(codePoint)), glyph])
    )}
} as unknown as GlyphMap;

function bucketSetup(text = 'abcde') {
    return createSymbolBucket('test', 'Test', text, collisionBoxArray);
}

function createIndexedFeature(id: number, index: number, iconId: string): IndexedFeature {
    return {
        feature: {
            extent: 8192,
            type: 1,
            id,
            properties: {
                icon: iconId
            },
            loadGeometry() {
                return [[{x: 0, y: 0}]];
            }
        },
        id,
        index,
        sourceLayerIndex: 0
    } as any as IndexedFeature;
}

function glyphsRequestedFor(text: string): string[] {
    const bucket = createSymbolBucket('test', 'Test', text, collisionBoxArray);
    const options = createPopulateOptions([]);
    const feature = {
        type: 1,
        id: 1,
        properties: {},
        loadGeometry: () => [[{x: 0, y: 0}]],
    };

    bucket.populate(
        [{feature, id: 1, index: 0, sourceLayerIndex: 0} as unknown as IndexedFeature],
        options,
        new CanonicalTileID(0, 0, 0),
    );

    return Object.keys(options.glyphDependencies.Test?.default ?? {});
}

describe('SymbolBucket', () => {
    let features: IndexedFeature[];
    beforeAll(() => {
        // Load point features from fixture tile.
        const sourceLayer = loadVectorTile().layers.place_label;
        features = [{feature: sourceLayer.feature(10)} as unknown as IndexedFeature];
    });
    test('SymbolBucket', () => {
        const bucketA = bucketSetup();
        const bucketB = bucketSetup();
        const options = createPopulateOptions([]);
        const placement = new Placement(transform, undefined, 0, true);
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const crossTileSymbolIndex = new CrossTileSymbolIndex();

        // add feature from bucket A
        bucketA.populate(features, options, undefined);
        performSymbolLayout(
            {
                bucket: bucketA,
                glyphMap: glyphsByCluster,
                glyphPositions: {},
                subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
            } as any);
        const tileA = new Tile(tileID, 512);
        tileA.latestFeatureIndex = new FeatureIndex(tileID);
        tileA.buckets = {test: bucketA};
        tileA.collisionBoxArray = collisionBoxArray;

        // add same feature from bucket B
        bucketB.populate(features, options, undefined);
        performSymbolLayout({
            bucket: bucketB, glyphMap: glyphsByCluster, glyphPositions: {}, subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
        } as any);
        const tileB = new Tile(tileID, 512);
        tileB.buckets = {test: bucketB};
        tileB.collisionBoxArray = collisionBoxArray;

        crossTileSymbolIndex.addLayer(bucketA.layers[0], [tileA, tileB], undefined);

        const place = (layer, tile) => {
            const parts = [];
            placement.getBucketParts(parts, layer, tile, false);
            for (const part of parts) {
                placement.placeLayerBucketPart(part, {}, false);
            }
        };
        const a = placement.collisionIndex.grid.keysLength();
        place(bucketA.layers[0], tileA);
        const b = placement.collisionIndex.grid.keysLength();
        expect(a).not.toBe(b);

        const a2 = placement.collisionIndex.grid.keysLength();
        place(bucketB.layers[0], tileB);
        const b2 = placement.collisionIndex.grid.keysLength();
        expect(b2).toBe(a2);
    });

    test('SymbolBucket integer overflow', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const bucket = bucketSetup();
        bucket.maxGlyphs = 5;

        const options = {iconDependencies: {}, glyphDependencies: {}} as PopulateParameters;

        bucket.populate(features, options, undefined);
        const fakeGlyph = {rect: {w: 10, h: 10}, metrics: {left: 10, top: 10, advance: 10}};
        performSymbolLayout({
            bucket,
            glyphMap: glyphsByCluster,
            glyphPositions: {'Test': {default: {a: fakeGlyph, b: fakeGlyph, c: fakeGlyph, d: fakeGlyph, e: fakeGlyph, f: fakeGlyph}} as any},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
        } as any);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0]).toContain('Too many glyphs being rendered in a tile.');
    });

    test('SymbolBucket image undefined sdf', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        spy.mockReset();

        const imageMap = {
            a: {
                data: new RGBAImage({width: 0, height: 0})
            },
            b: {
                data: new RGBAImage({width: 0, height: 0}),
                sdf: false
            }
        } as any as { [_: string]: StyleImage };
        const imagePos = {
            a: new ImagePosition({x: 0, y: 0, w: 10, h: 10}, 1 as any as StyleImage),
            b: new ImagePosition({x: 10, y: 0, w: 10, h: 10}, 1 as any as StyleImage)
        };
        const bucket = createSymbolIconBucket('test', 'icon', collisionBoxArray);
        const options = createPopulateOptions([]);

        bucket.populate(
            [
                createIndexedFeature(0, 0, 'a'),
                createIndexedFeature(1, 1, 'b'),
                createIndexedFeature(2, 2, 'a')
            ],
            options, undefined
        );

        const icons = options.iconDependencies;
        expect(icons.a).toBe(true);
        expect(icons.b).toBe(true);

        performSymbolLayout({
            bucket, imageMap, imagePositions: imagePos,
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
        } as any);

        // undefined SDF should be treated the same as false SDF - no warning raised
        expect(spy).not.toHaveBeenCalledTimes(1);
    });

    test('SymbolBucket image mismatched sdf', () => {
        const originalWarn = console.warn;
        console.warn = vi.fn();

        const imageMap = {
            a: {
                data: new RGBAImage({width: 0, height: 0}),
                sdf: true
            },
            b: {
                data: new RGBAImage({width: 0, height: 0}),
                sdf: false
            }
        } as any as { [_: string]: StyleImage };
        const imagePos = {
            a: new ImagePosition({x: 0, y: 0, w: 10, h: 10}, 1 as any as StyleImage),
            b: new ImagePosition({x: 10, y: 0, w: 10, h: 10}, 1 as any as StyleImage)
        };
        const bucket = createSymbolIconBucket('test', 'icon', collisionBoxArray);
        const options = createPopulateOptions([]);

        bucket.populate(
            [
                createIndexedFeature(0, 0, 'a'),
                createIndexedFeature(1, 1, 'b'),
                createIndexedFeature(2, 2, 'a')
            ],
            options, undefined
        );

        const icons = options.iconDependencies;
        expect(icons.a).toBe(true);
        expect(icons.b).toBe(true);

        performSymbolLayout({bucket, imageMap, imagePositions: imagePos, subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision} as any);

        // true SDF and false SDF in same bucket should trigger warning
        expect(console.warn).toHaveBeenCalledTimes(1);
        console.warn = originalWarn;
    });

    test('SymbolBucket detects rtl text', () => {
        const rtlBucket = bucketSetup('مرحبا');
        const ltrBucket = bucketSetup('hello');
        const options = createPopulateOptions([]);
        rtlBucket.populate(features, options, undefined);
        ltrBucket.populate(features, options, undefined);

        expect(rtlBucket.hasRTLText).toBeTruthy();
        expect(ltrBucket.hasRTLText).toBeFalsy();
    });

    test('SymbolBucket shapes rtl text', () => {
        expect(glyphsRequestedFor('مرحبا')).toEqual(['ﻣ', 'ﺮ', 'ﺣ', 'ﺒ', 'ﺎ']);
    });

    test('SymbolBucket detects rtl text mixed with ltr text', () => {
        const mixedBucket = bucketSetup('مرحبا translates to hello');
        const options = createPopulateOptions([]);
        mixedBucket.populate(features, options, undefined);

        expect(mixedBucket.hasRTLText).toBeTruthy();
    });

    test('SymbolBucket asks for one glyph per character of plain text and nothing besides', () => {
        expect(glyphsRequestedFor('abc').sort()).toEqual(['a', 'b', 'c']);
        expect(glyphsRequestedFor('東京ー').sort()).toEqual(['東', '京', 'ー'].sort());
    });

    test('SymbolBucket asks for a cluster as a whole, and for its codepoints to fall back to', () => {
        const hebrew = glyphsRequestedFor('שְׁ');
        expect(hebrew).toContain('שְׁ');
        expect(hebrew).toEqual(expect.arrayContaining(['ש', 'ְ', 'ׁ']));

        const devanagari = glyphsRequestedFor('दि');
        expect(devanagari).toContain('दि');
        expect(devanagari).toEqual(expect.arrayContaining(['द', 'ि']));
    });
});

describe('SymbolBucket.addFeatures cross-tile key', () => {
    const symbolLayer = createSymbolStyleLayer('test', 'Test', 'abcde');
    const promoteId = 'name';
    const parentTileID = new OverscaledTileID(6, 0, 6, 8, 8);
    const northWestChildTileID = new OverscaledTileID(7, 0, 7, 16, 16);
    const anchorInParentTile = {x: 1000, y: 1000};
    const sameSpotInNorthWestChildTile = {x: anchorInParentTile.x * 2, y: anchorInParentTile.y * 2};

    type Label = {id: number | string; anchor: {x: number; y: number}; properties: Record<string, unknown>};

    /**
     * Lays out one point label per entry, in order, with the feature id the worker would have resolved through
     * `featureIndex`.
     */
    function createTileWithLabels(featureIndex: FeatureIndex, labels: Label[]): Tile {
        const features = labels.map(({id, anchor, properties}, index) => ({
            feature: {extent: 8192, type: 1, id, properties, loadGeometry: () => [[anchor]]},
            id,
            index,
            sourceLayerIndex: 0
        }) as any as IndexedFeature);
        const bucket = new SymbolBucket({overscaling: 1, zoom: 0, collisionBoxArray, layers: [symbolLayer]} as BucketParameters<SymbolStyleLayer>);
        const options = {...createPopulateOptions([]), featureIndex};
        bucket.populate(features, options, featureIndex.tileID.canonical);
        bucket.addFeatures({
            options,
            canonical: featureIndex.tileID.canonical,
            glyphMap: glyphsByCluster,
            glyphPositions: {},
            iconMap: {},
            iconPositions: {},
            patternMap: {},
            patternPositions: {},
            dashPositions: {},
            showCollisionBoxes: false
        });
        const tile = new Tile(featureIndex.tileID, 512);
        tile.buckets = {[symbolLayer.id]: bucket};
        return tile;
    }

    function crossTileIDOfLabel(tile: Tile, featureId: number | string): number {
        const bucket = tile.getBucket(symbolLayer) as SymbolBucket;
        for (let i = 0; i < bucket.symbolInstances.length; i++) {
            const symbolInstance = bucket.symbolInstances.get(i);
            if (bucket.features[symbolInstance.featureIndex].id === featureId) {
                return symbolInstance.crossTileID;
            }
        }
        throw new Error(`No label for feature ${featureId}`);
    }

    test('with promoteId, a label matches the same feature\'s label in the parent tile, not another feature\'s label laid out first at the same spot', () => {
        const parentTile = createTileWithLabels(new FeatureIndex(parentTileID, promoteId), [
            {id: 'a', anchor: anchorInParentTile, properties: {}}
        ]);
        const childTile = createTileWithLabels(new FeatureIndex(northWestChildTileID, promoteId), [
            {id: 'b', anchor: sameSpotInNorthWestChildTile, properties: {}},
            {id: 'a', anchor: sameSpotInNorthWestChildTile, properties: {}}
        ]);

        new CrossTileSymbolIndex().addLayer(symbolLayer, [parentTile, childTile], 0);

        expect(crossTileIDOfLabel(childTile, 'a')).toBe(crossTileIDOfLabel(parentTile, 'a'));
        expect(crossTileIDOfLabel(childTile, 'b')).not.toBe(crossTileIDOfLabel(parentTile, 'a'));
    });

    test('without promoteId, a label matches the label at the same spot in the parent tile whatever the two feature ids are', () => {
        const parentTile = createTileWithLabels(new FeatureIndex(parentTileID), [
            {id: 1, anchor: anchorInParentTile, properties: {}}
        ]);
        const childTile = createTileWithLabels(new FeatureIndex(northWestChildTileID), [
            {id: 2, anchor: sameSpotInNorthWestChildTile, properties: {}}
        ]);

        new CrossTileSymbolIndex().addLayer(symbolLayer, [parentTile, childTile], 0);

        expect(crossTileIDOfLabel(childTile, 2)).toBe(crossTileIDOfLabel(parentTile, 1));
    });

    test('with promoteId, a cluster label matches the cluster label at the same spot in the parent tile although a cluster has a different id at every zoom', () => {
        const parentTile = createTileWithLabels(new FeatureIndex(parentTileID, promoteId), [
            {id: 100, anchor: anchorInParentTile, properties: {cluster: true, cluster_id: 100}}
        ]);
        const childTile = createTileWithLabels(new FeatureIndex(northWestChildTileID, promoteId), [
            {id: 200, anchor: sameSpotInNorthWestChildTile, properties: {cluster: true, cluster_id: 200}}
        ]);

        new CrossTileSymbolIndex().addLayer(symbolLayer, [parentTile, childTile], 0);

        expect(crossTileIDOfLabel(childTile, 200)).toBe(crossTileIDOfLabel(parentTile, 100));
    });
});
