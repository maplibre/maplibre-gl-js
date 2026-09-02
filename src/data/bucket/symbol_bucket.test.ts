import {describe, test, expect, vi, beforeAll} from 'vitest';
import {SymbolBucket} from './symbol_bucket.ts';
import {CollisionBoxArray} from '../../data/array_types.g.ts';
import {performSymbolLayout} from '../../symbol/symbol_layout.ts';
import {Placement} from '../../symbol/placement.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {Tile} from '../../tile/tile.ts';
import {CrossTileSymbolIndex} from '../../symbol/cross_tile_symbol_index.ts';
import {FeatureIndex} from '../../data/feature_index.ts';
import {createSymbolBucket, createSymbolIconBucket} from '../../../test/unit/lib/create_symbol_layer.ts';
import {RGBAImage} from '../../util/image.ts';
import {ImagePosition} from '../../render/image_atlas.ts';
import {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings.ts';
import {MercatorTransform} from '../../geo/projection/mercator_transform.ts';
import {createPopulateOptions, loadVectorTile} from '../../../test/unit/lib/tile.ts';
import {SymbolStyleLayer} from '../../style/style_layer/symbol_style_layer.ts';
import {featureFilter, type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../../style/evaluation_parameters.ts';
import {ICON_ROTATE_WITH_MAP_FLAG} from '../../symbol/symbol_size.ts';
import type {IndexedFeature, PopulateParameters} from '../bucket.ts';
import type {BucketParameters} from '../bucket.ts';
import type {StyleImage} from '../../style/style_image.ts';
import type {StyleGlyph} from '../../style/style_glyph.ts';
import glyphs from '../../../test/unit/assets/fontstack-glyphs.json' with {type: 'json'};

const collisionBoxArray = new CollisionBoxArray();
const transform = new MercatorTransform();
transform.resize(100, 100);

const stacks = {'Test': glyphs} as any as {
    [_: string]: {
        [x: number]: StyleGlyph;
    };
};

function bucketSetup(text = 'abcde') {
    return createSymbolBucket('test', 'Test', text, collisionBoxArray);
}

function createIndexedFeature(id: number, index: number, iconId: string, alignment?: string): IndexedFeature {
    return {
        feature: {
            extent: 8192,
            type: 1,
            id,
            properties: {
                icon: iconId,
                alignment
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
                glyphMap: stacks,
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
            bucket: bucketB, glyphMap: stacks, glyphPositions: {}, subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
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

    test('preserves data-driven icon rotation alignment for rendering and collision placement', () => {
        const iconCollisionBoxArray = new CollisionBoxArray();
        const layer = new SymbolStyleLayer({
            id: 'test',
            type: 'symbol',
            source: 'source',
            layout: {
                'icon-image': ['get', 'icon'],
                'icon-rotation-alignment': ['get', 'alignment']
            },
            filter: featureFilter(undefined, 'filter')
        } as unknown as LayerSpecification, {});
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, []);
        const bucket = new SymbolBucket({
            overscaling: 1,
            zoom: 0,
            collisionBoxArray: iconCollisionBoxArray,
            layers: [layer]
        } as BucketParameters<SymbolStyleLayer>);
        const options = createPopulateOptions([]);
        const image = {data: new RGBAImage({width: 0, height: 0}), sdf: false} as StyleImage;

        bucket.populate([
            createIndexedFeature(0, 0, 'icon', 'map'),
            createIndexedFeature(1, 1, 'icon', 'viewport')
        ], options, undefined);
        performSymbolLayout({
            bucket,
            imageMap: {icon: image},
            imagePositions: {icon: new ImagePosition({x: 0, y: 0, w: 10, h: 10}, image)},
            subdivisionGranularity: SubdivisionGranularitySetting.noSubdivision
        } as any);

        const uint16ValuesPerVertex = 14;
        const rotationValueOffset = 7;
        const verticesPerIcon = 4;
        const firstIconRotation = bucket.icon.layoutVertexArray.uint16[rotationValueOffset];
        const secondIconRotation = bucket.icon.layoutVertexArray.uint16[
            verticesPerIcon * uint16ValuesPerVertex + rotationValueOffset
        ];

        expect(firstIconRotation & ICON_ROTATE_WITH_MAP_FLAG).toBe(ICON_ROTATE_WITH_MAP_FLAG);
        expect(secondIconRotation & ICON_ROTATE_WITH_MAP_FLAG).toBe(0);

        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const tile = new Tile(tileID, 512);
        tile.latestFeatureIndex = new FeatureIndex(tileID);
        tile.buckets = {test: bucket};
        tile.collisionBoxArray = iconCollisionBoxArray;
        new CrossTileSymbolIndex().addLayer(layer, [tile], undefined);

        const placement = new Placement(transform, undefined, 0, true);
        const collisionBoxPlacement = vi.spyOn(placement.collisionIndex, 'placeCollisionBox');
        const bucketParts = [];
        placement.getBucketParts(bucketParts, layer, tile, false);
        placement.placeLayerBucketPart(bucketParts[0], {}, false);

        const collisionRotationsWithMap = collisionBoxPlacement.mock.calls.map(
            ([, , , , , , rotatesWithMap]) => rotatesWithMap);
        expect(collisionRotationsWithMap).toEqual([true, false]);
    });

    test('SymbolBucket integer overflow', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        SymbolBucket.MAX_GLYPHS = 5;

        const bucket = bucketSetup();
        const options = {iconDependencies: {}, glyphDependencies: {}} as PopulateParameters;

        bucket.populate(features, options, undefined);
        const fakeGlyph = {rect: {w: 10, h: 10}, metrics: {left: 10, top: 10, advance: 10}};
        performSymbolLayout({
            bucket,
            glyphMap: stacks,
            glyphPositions: {'Test': {97: fakeGlyph, 98: fakeGlyph, 99: fakeGlyph, 100: fakeGlyph, 101: fakeGlyph, 102: fakeGlyph} as any},
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

        const icons = options.iconDependencies as any;
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

        const icons = options.iconDependencies as any;
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

    // Test to prevent symbol bucket with rtl from text being culled by worker serialization.
    test('SymbolBucket with rtl text is NOT empty even though no symbol instances are created', () => {
        const rtlBucket = bucketSetup('مرحبا');
        const options = createPopulateOptions([]);
        rtlBucket.createArrays();
        rtlBucket.populate(features, options, undefined);

        expect(rtlBucket.isEmpty()).toBeFalsy();
        expect(rtlBucket.symbolInstances).toHaveLength(0);
    });

    test('SymbolBucket detects rtl text mixed with ltr text', () => {
        const mixedBucket = bucketSetup('مرحبا translates to hello');
        const options = createPopulateOptions([]);
        mixedBucket.populate(features, options, undefined);

        expect(mixedBucket.hasRTLText).toBeTruthy();
    });
});
