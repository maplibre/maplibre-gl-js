import {describe, expect, test} from 'vitest';
import {SymbolBucket} from './symbol_bucket.ts';
import {createSymbolBucket} from '../../../test/unit/lib/create_symbol_layer.ts';
import {CollisionBoxArray} from '../array_types.g.ts';
import {CanonicalTileID} from '../../tile/tile_id.ts';
import type {IndexedFeature, PopulateParameters} from '../bucket.ts';

/**
 * The glyphs a tile asks for, given a label.
 *
 * These are what decides whether a letter written with marks on it can be drawn as the one shape it
 * is written as: the cluster has to be asked for, or there is nothing to draw it with.
 */
function glyphDependencies(text: string): string[] {
    const bucket = createSymbolBucket('test', 'Test', text, new CollisionBoxArray()) as SymbolBucket;
    const options = {glyphDependencies: {}, iconDependencies: {}, availableImages: []} as unknown as PopulateParameters;
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

    return Object.keys((options.glyphDependencies as {[stack: string]: {[key: string]: boolean}}).Test ?? {});
}

describe('glyph dependencies', () => {
    test('asks for one glyph per character of plain text', () => {
        expect(glyphDependencies('abc').sort()).toEqual(['a', 'b', 'c']);
    });

    test('asks for a Hebrew letter with its vowel points as one cluster, and for its codepoints', () => {
        const dependencies = glyphDependencies('שְׁ');

        // The cluster, so that it can be drawn as one shape where a font file covers it...
        expect(dependencies).toContain('שְׁ');
        // ...and its codepoints, so that there is something to fall back to where none does.
        expect(dependencies).toEqual(expect.arrayContaining(['ש', 'ְ', 'ׁ']));
    });

    test('asks for a Devanagari syllable as one cluster', () => {
        const dependencies = glyphDependencies('दि');

        expect(dependencies).toContain('दि');
        expect(dependencies).toEqual(expect.arrayContaining(['द', 'ि']));
    });

    test('asks for nothing extra where a character stands alone', () => {
        // A single codepoint is its own cluster, so there is no second key for it.
        expect(glyphDependencies('a')).toEqual(['a']);
    });
});
