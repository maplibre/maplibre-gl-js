import fs from 'fs';
import path from 'path';
import {RequestManager} from '../util/request_manager';
import loadSprite from './load_sprite';
import {fakeXhr} from 'nise';

test('loadSprite', done => {
    jest.setTimeout(10000);
    global.fetch = null;

    const transform = jest.fn().mockImplementation((url) => {
        return {url};
    });

    const manager = new RequestManager(transform);

    const requests = [];
    fakeXhr.useFakeXMLHttpRequest().onCreate = (req) => { requests.push(req); };

    loadSprite('https://localhost/sprite1', manager, 1, (err, result) => {
        expect(err).toBeFalsy();
        // expect(transform).toHaveBeenCalledTimes(1);
        // expect(transform).toHaveBeenCalledWith('https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf', 'Glyphs');
        //
        // expect(Object.keys(result)).toHaveLength(223);
        // for (const key in result) {
        //     const id = Number(key);
        //     const glyph = result[id];
        //
        //     expect(glyph.id).toBe(Number(id));
        //     expect(glyph.metrics).toBeTruthy();
        //     expect(typeof glyph.metrics.width).toBe('number');
        //     expect(typeof glyph.metrics.height).toBe('number');
        //     expect(typeof glyph.metrics.top).toBe('number');
        //     expect(typeof glyph.metrics.advance).toBe('number');
        // }
        done();
    });

    expect(requests[0].url).toBe('https://localhost/sprite1.json');
    requests[0].setStatus(200);
    requests[0].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json'));
    requests[0].onload();

    expect(requests[1].url).toBe('https://localhost/sprite1.png');
    requests[1].setStatus(200);
    const src = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png'), {encoding: 'base64'});
    const img = createImageBitmap(new Image(src)).then(() => {
        requests[1].response = img;
        requests[1].onload();
    });

});
