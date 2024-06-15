import {getArrayBuffer} from '../util/ajax.ts';
import {ResourceType} from '../util/request_manager.ts';

import {parseGlyphPbf} from './parse_glyph_pbf.ts';

import type {StyleGlyph} from './style_glyph.ts';
import type {RequestManager} from '../util/request_manager.ts';

export async function loadGlyphRange(fontstack: string,
    range: number,
    urlTemplate: string,
    requestManager: RequestManager): Promise<{[_: number]: StyleGlyph | null}> {
    const begin = range * 256;
    const end = begin + 255;

    const request = requestManager.transformRequest(
        urlTemplate.replace('{fontstack}', fontstack).replace('{range}', `${begin}-${end}`),
        ResourceType.Glyphs
    );

    const response = await getArrayBuffer(request, new AbortController());
    if (!response || !response.data) {
        throw new Error(`Could not load glyph range. range: ${range}, ${begin}-${end}`);
    }
    const glyphs = {};

    for (const glyph of parseGlyphPbf(response.data)) {
        glyphs[glyph.id] = glyph;
    }

    return glyphs;
}
