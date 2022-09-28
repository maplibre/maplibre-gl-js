import {getArrayBuffer, ResourceType} from '../util/ajax';

import parseGlyphPBF from './parse_glyph_pbf';

import type {StyleGlyph} from './style_glyph';
import type {RequestManager} from '../util/request_manager';
import type {Callback} from '../types/callback';

export default function loadGlyphRange(fontstack: string,
    range: number,
    urlTemplate: string,
    requestManager: RequestManager,
    callback: Callback<{
        [_: number]: StyleGlyph | null;
    }>) {
    const begin = range * 256;
    const end = begin + 255;

    const request = requestManager.transformRequest(
        urlTemplate.replace('{fontstack}', fontstack).replace('{range}', `${begin}-${end}`),
        ResourceType.Glyphs
    );

    getArrayBuffer(request, (err?: Error | null, data?: ArrayBuffer | null) => {
        if (err) {
            callback(err);
        } else if (data) {
            const glyphs = {};

            for (const glyph of parseGlyphPBF(data)) {
                glyphs[glyph.id] = glyph;
            }

            callback(null, glyphs);
        }
    });
}
