import {getArrayBufferNew, ResourceType} from '../util/ajax';

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

    const request = getArrayBufferNew(requestManager.transformRequest(
        urlTemplate.replace('{fontstack}', fontstack).replace('{range}', `${begin}-${end}`),
        ResourceType.Glyphs
    ));

    request.response.then(response => {
        const glyphs = {};

        for (const glyph of parseGlyphPBF(response.data)) {
            glyphs[glyph.id] = glyph;
        }

        callback(null, glyphs);
    }).catch(err => {
        callback(err);
    });
}
