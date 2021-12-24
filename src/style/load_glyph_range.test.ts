import fs from 'fs';
import path from 'path';
import {RequestManager} from '../util/request_manager';
import loadGlyphRange from './load_glyph_range';
import {getSinonXMLHttpRequest} from '../util/test/util';

test('loadGlyphRange', done => {
    const transform = jest.fn().mockImplementation((url) => {
        return {url};
    });

    const manager = new RequestManager(transform);

    let request;
    getSinonXMLHttpRequest().onCreate = (req) => { request = req; };

    loadGlyphRange('Arial Unicode MS', 0, 'https://localhost/fonts/v1/{fontstack}/{range}.pbf', manager, (err, result) => {
        expect(err).toBeFalsy();
        expect(transform).toHaveBeenCalledTimes(1);
        expect(transform).toHaveBeenCalledWith('https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf', 'Glyphs');

        if (!result) return done.fail(); // appease flow

        expect(Object.keys(result)).toHaveLength(223);
        for (const key in result) {
            const id = Number(key);
            const glyph = result[id];

            if (!glyph) return done.fail(); // appease flow

            expect(glyph.id).toBe(Number(id));
            expect(glyph.metrics).toBeTruthy();
            expect(typeof glyph.metrics.width).toBe('number');
            expect(typeof glyph.metrics.height).toBe('number');
            expect(typeof glyph.metrics.top).toBe('number');
            expect(typeof glyph.metrics.advance).toBe('number');
        }
        done();
    });

    if (!request) return done.fail(); // appease flow

    expect(request.url).toBe('https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf');
    request.setStatus(200);
    request.response = fs.readFileSync(path.join(__dirname, '../../test/fixtures/0-255.pbf'));
    request.onload();
});
