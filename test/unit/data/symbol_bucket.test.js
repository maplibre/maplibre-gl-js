import '../../stub_loader';
import {test} from '../../util/test';
import fs from 'fs';
import path, {dirname} from 'path';
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import SymbolBucket from '../../../rollup/build/tsc/src/data/bucket/symbol_bucket';
import {CollisionBoxArray} from '../../../rollup/build/tsc/src/data/array_types';
import {performSymbolLayout} from '../../../rollup/build/tsc/src/symbol/symbol_layout';
import {Placement} from '../../../rollup/build/tsc/src/symbol/placement';
import Transform from '../../../rollup/build/tsc/src/geo/transform';
import {OverscaledTileID} from '../../../rollup/build/tsc/src/source/tile_id';
import Tile from '../../../rollup/build/tsc/src/source/tile';
import CrossTileSymbolIndex from '../../../rollup/build/tsc/src/symbol/cross_tile_symbol_index';
import FeatureIndex from '../../../rollup/build/tsc/src/data/feature_index';
import {createSymbolBucket, createSymbolIconBucket} from '../../util/create_symbol_layer';
import {fileURLToPath} from 'url';
import {RGBAImage} from '../../../rollup/build/tsc/src/util/image';
import {ImagePosition} from '../../../rollup/build/tsc/src/render/image_atlas';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load a point feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
const feature = vt.layers.place_label.feature(10);
const glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')));

/*eslint new-cap: 0*/
const collisionBoxArray = new CollisionBoxArray();
const transform = new Transform();
transform.width = 100;
transform.height = 100;
transform.cameraToCenterDistance = 100;

const stacks = {'Test': glyphs};

function bucketSetup(text = 'abcde') {
    return createSymbolBucket('test', 'Test', text, collisionBoxArray);
}

function createIndexedFeature(id, index, iconId) {
    return {
        feature: {
            extent: 8192,
            type: 1,
            id,
            properties: {
                icon: iconId
            },
            loadGeometry: function () {
                return [[{x: 0, y: 0}]]
            }
        },
        id,
        index,
        sourceLayerIndex: 0
    };
}

test('SymbolBucket', (t) => {
    const bucketA = bucketSetup();
    const bucketB = bucketSetup();
    const options = {iconDependencies: {}, glyphDependencies: {}};
    const placement = new Placement(transform, 0, true);
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const crossTileSymbolIndex = new CrossTileSymbolIndex();

    // add feature from bucket A
    bucketA.populate([{feature}], options);
    performSymbolLayout(bucketA, stacks, {});
    const tileA = new Tile(tileID, 512);
    tileA.latestFeatureIndex = new FeatureIndex(tileID);
    tileA.buckets = {test: bucketA};
    tileA.collisionBoxArray = collisionBoxArray;

    // add same feature from bucket B
    bucketB.populate([{feature}], options);
    performSymbolLayout(bucketB, stacks, {});
    const tileB = new Tile(tileID, 512);
    tileB.buckets = {test: bucketB};
    tileB.collisionBoxArray = collisionBoxArray;

    crossTileSymbolIndex.addLayer(bucketA.layers[0], [tileA, tileB]);

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
    t.notEqual(a, b, 'places feature');

    const a2 = placement.collisionIndex.grid.keysLength();
    place(bucketB.layers[0], tileB);
    const b2 = placement.collisionIndex.grid.keysLength();
    t.equal(b2, a2, 'detects collision and does not place feature');
    t.end();
});

test('SymbolBucket integer overflow', (t) => {
    t.stub(console, 'warn');
    t.stub(SymbolBucket, 'MAX_GLYPHS').value(5);

    const bucket = bucketSetup();
    const options = {iconDependencies: {}, glyphDependencies: {}};

    bucket.populate([{feature}], options);
    const fakeGlyph = {rect: {w: 10, h: 10}, metrics: {left: 10, top: 10, advance: 10}};
    performSymbolLayout(bucket, stacks, {'Test': {97: fakeGlyph, 98: fakeGlyph, 99: fakeGlyph, 100: fakeGlyph, 101: fakeGlyph, 102: fakeGlyph}});

    t.ok(console.warn.calledOnce);
    t.ok(console.warn.getCall(0).calledWithMatch(/Too many glyphs being rendered in a tile./));
    t.end();
});

test('SymbolBucket image undefined sdf', (t) => {
    t.stub(console, 'warn').callsFake(() => { });

    const imageMap = {
        a: {
            data: new RGBAImage({ width: 0, height: 0 })
        },
        b: {
            data: new RGBAImage({ width: 0, height: 0 }),
            sdf: false
        }
    };
    const imagePos = {
        a: new ImagePosition({ x: 0, y: 0, w: 10, h: 10 }, 1, 1),
        b: new ImagePosition({ x: 10, y: 0, w: 10, h: 10 }, 1, 1)
    };
    const bucket = createSymbolIconBucket('test', 'icon', collisionBoxArray);
    const options = { iconDependencies: {}, glyphDependencies: {} };

    bucket.populate(
        [
            createIndexedFeature(0, 0, 'a'),
            createIndexedFeature(1, 1, 'b'),
            createIndexedFeature(2, 2, 'a')
        ],
        options
    );

    const icons = options.iconDependencies;
    t.equal(icons.a, true, 'references icon a');
    t.equal(icons.b, true, 'references icon b');

    performSymbolLayout(bucket, null, null, imageMap, imagePos);

    // undefined SDF should be treated the same as false SDF - no warning raised
    t.ok(!console.warn.calledOnce);
    t.end();
});

test('SymbolBucket image mismatched sdf', (t) => {
    t.stub(console, 'warn').callsFake(() => { });

    const imageMap = {
        a: {
            data: new RGBAImage({ width: 0, height: 0 }),
            sdf: true
        },
        b: {
            data: new RGBAImage({ width: 0, height: 0 }),
            sdf: false
        }
    };
    const imagePos = {
        a: new ImagePosition({ x: 0, y: 0, w: 10, h: 10 }, 1, 1),
        b: new ImagePosition({ x: 10, y: 0, w: 10, h: 10 }, 1, 1)
    };
    const bucket = createSymbolIconBucket('test', 'icon', collisionBoxArray);
    const options = { iconDependencies: {}, glyphDependencies: {} };

    bucket.populate(
        [
            createIndexedFeature(0, 0, 'a'),
            createIndexedFeature(1, 1, 'b'),
            createIndexedFeature(2, 2, 'a')
        ],
        options
    );

    const icons = options.iconDependencies;
    t.equal(icons.a, true, 'references icon a');
    t.equal(icons.b, true, 'references icon b');

    performSymbolLayout(bucket, null, null, imageMap, imagePos);

    // true SDF and false SDF in same bucket should trigger warning
    t.ok(console.warn.calledOnce);
    t.end();
});

test('SymbolBucket detects rtl text', (t) => {
    const rtlBucket = bucketSetup('مرحبا');
    const ltrBucket = bucketSetup('hello');
    const options = {iconDependencies: {}, glyphDependencies: {}};
    rtlBucket.populate([{feature}], options);
    ltrBucket.populate([{feature}], options);

    t.ok(rtlBucket.hasRTLText);
    t.notOk(ltrBucket.hasRTLText);
    t.end();
});

// Test to prevent symbol bucket with rtl from text being culled by worker serialization.
test('SymbolBucket with rtl text is NOT empty even though no symbol instances are created', (t) => {
    const rtlBucket = bucketSetup('مرحبا');
    const options = {iconDependencies: {}, glyphDependencies: {}};
    rtlBucket.createArrays();
    rtlBucket.populate([{feature}], options);

    t.notOk(rtlBucket.isEmpty());
    t.equal(rtlBucket.symbolInstances.length, 0);
    t.end();
});

test('SymbolBucket detects rtl text mixed with ltr text', (t) => {
    const mixedBucket = bucketSetup('مرحبا translates to hello');
    const options = {iconDependencies: {}, glyphDependencies: {}};
    mixedBucket.populate([{feature}], options);

    t.ok(mixedBucket.hasRTLText);
    t.end();
});

