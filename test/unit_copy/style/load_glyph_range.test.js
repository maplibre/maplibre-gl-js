import '../../stub_loader';
import {test} from '../../util/test';
import fs from 'fs';
import path, {dirname} from 'path';
import {RequestManager} from '../../../rollup/build/tsc/util/request_manager';
import loadGlyphRange from '../../../rollup/build/tsc/style/load_glyph_range';
import {fileURLToPath} from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

test('loadGlyphRange', (t) => {
    window.useFakeXMLHttpRequest();

    t.tearDown(() => {
        window.clearFakeXMLHttpRequest();
    });

    const transform = t.stub().callsFake((url) => ({url}));
    const manager = new RequestManager(transform);

    let request;
    XMLHttpRequest.onCreate = (req) => { request = req; };

    loadGlyphRange('Arial Unicode MS', 0, 'https://localhost/fonts/v1/{fontstack}/{range}.pbf', manager, (err, result) => {
        expect(err).toBeFalsy();
        expect(transform.calledOnce).toBeTruthy();
        expect(transform.getCall(0).args).toEqual(['https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf', 'Glyphs']);

        if (!result) return t.fail(); // appease flow

        expect(Object.keys(result).length).toBe(223);
        for (const key in result) {
            const id = Number(key);
            const glyph = result[id];
            if (!glyph) return t.fail(); // appease flow
            expect(glyph.id).toBe(Number(id));
            expect(glyph.metrics).toBeTruthy();
            expect(typeof glyph.metrics.width).toBe('number');
            expect(typeof glyph.metrics.height).toBe('number');
            expect(typeof glyph.metrics.top).toBe('number');
            expect(typeof glyph.metrics.advance).toBe('number');
        }
        t.end();
    });

    if (!request) return t.fail(); // appease flow

    expect(request.url).toBe('https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf');
    request.setStatus(200);
    request.response = fs.readFileSync(path.join(__dirname, '../../fixtures/0-255.pbf'));
    request.onload();

});
