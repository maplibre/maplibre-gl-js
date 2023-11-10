import {parseGlyphPbf} from '../style/parse_glyph_pbf';
import {GlyphManager} from './glyph_manager';
import fs from 'fs';
import {RequestManager} from '../util/request_manager';

const glyphs = {};
for (const glyph of parseGlyphPbf(fs.readFileSync('./test/unit/assets/0-255.pbf'))) {
    glyphs[glyph.id] = glyph;
}

const identityTransform = ((url) => ({url})) as any as RequestManager;

const createLoadGlyphRangeStub = () => {
    return jest.spyOn(GlyphManager, 'loadGlyphRange').mockImplementation((stack, range, urlTemplate, transform, callback) => {
        expect(stack).toBe('Arial Unicode MS');
        expect(range).toBe(0);
        expect(urlTemplate).toBe('https://localhost/fonts/v1/{fontstack}/{range}.pbf');
        expect(transform).toBe(identityTransform);
        setTimeout(() => callback(null, glyphs), 0);
    });
};

const createGlyphManager = (font?) => {
    const manager = new GlyphManager(identityTransform, font);
    manager.setURL('https://localhost/fonts/v1/{fontstack}/{range}.pbf');
    return manager;
};

afterEach(() => {
    jest.clearAllMocks();
});

describe('GlyphManager', () => {

    test('GlyphManager requests 0-255 PBF', done => {
        createLoadGlyphRangeStub();
        const manager = createGlyphManager();

        manager.getGlyphs({'Arial Unicode MS': [55]}, (err, glyphs) => {
            expect(err).toBeFalsy();
            expect(glyphs['Arial Unicode MS']['55'].metrics.advance).toBe(12);
            done();
        });
    });

    test('GlyphManager doesn\'t request twice 0-255 PBF if a glyph is missing', done => {
        const stub = createLoadGlyphRangeStub();
        const manager = createGlyphManager();

        manager.getGlyphs({'Arial Unicode MS': [0.5]}, (err) => {
            expect(err).toBeFalsy();
            expect(manager.entries['Arial Unicode MS'].ranges[0]).toBe(true);
            expect(stub).toHaveBeenCalledTimes(1);

            // We remove all requests as in getGlyphs code.
            delete manager.entries['Arial Unicode MS'].requests[0];

            manager.getGlyphs({'Arial Unicode MS': [0.5]}, (err) => {
                expect(err).toBeFalsy();
                expect(manager.entries['Arial Unicode MS'].ranges[0]).toBe(true);
                expect(stub).toHaveBeenCalledTimes(1);
                done();
            });
        });
    });

    test('GlyphManager requests remote CJK PBF', done => {
        jest.spyOn(GlyphManager, 'loadGlyphRange').mockImplementation((stack, range, urlTemplate, transform, callback) => {
            setTimeout(() => callback(null, glyphs), 0);
        });

        const manager = createGlyphManager();

        manager.getGlyphs({'Arial Unicode MS': [0x5e73]}, (err, glyphs) => {
            expect(err).toBeFalsy();
            expect(glyphs['Arial Unicode MS'][0x5e73]).toBeNull(); // The fixture returns a PBF without the glyph we requested
            done();
        });
    });

    test('GlyphManager does not cache CJK chars that should be rendered locally', done => {
        jest.spyOn(GlyphManager, 'loadGlyphRange').mockImplementation((stack, range, urlTemplate, transform, callback) => {
            const overlappingGlyphs = {};
            const start = range * 256;
            const end = start + 256;
            for (let i = start, j = 0; i < end; i++, j++) {
                overlappingGlyphs[i] = glyphs[j];
            }
            setTimeout(() => callback(null, overlappingGlyphs), 0);
        });

        const manager = createGlyphManager('sans-serif');

        //Request char that overlaps Katakana range
        manager.getGlyphs({'Arial Unicode MS': [0x3005]}, (err, glyphs) => {
            expect(err).toBeFalsy();
            expect(glyphs['Arial Unicode MS'][0x3005]).not.toBeNull();
            //Request char from Katakana range (te テ)
            manager.getGlyphs({'Arial Unicode MS': [0x30C6]}, (err, glyphs) => {
                expect(err).toBeFalsy();
                const glyph = glyphs['Arial Unicode MS'][0x30c6];
                //Ensure that te is locally generated.
                expect(glyph.bitmap.height).toBe(12);
                expect(glyph.bitmap.width).toBe(12);
                done();
            });
        });
    });

    test('GlyphManager generates CJK PBF locally', done => {
        const manager = createGlyphManager('sans-serif');

        // character 平
        manager.getGlyphs({'Arial Unicode MS': [0x5e73]}, (err, glyphs) => {
            expect(err).toBeFalsy();
            expect(glyphs['Arial Unicode MS'][0x5e73].metrics.advance).toBe(0.5);
            done();
        });
    });

    test('GlyphManager generates Katakana PBF locally', done => {
        const manager = createGlyphManager('sans-serif');

        // Katakana letter te テ
        manager.getGlyphs({'Arial Unicode MS': [0x30c6]}, (err, glyphs) => {
            expect(err).toBeFalsy();
            expect(glyphs['Arial Unicode MS'][0x30c6].metrics.advance).toBe(0.5);
            done();
        });
    });

    test('GlyphManager generates Hiragana PBF locally', done => {
        const manager = createGlyphManager('sans-serif');

        //Hiragana letter te て
        manager.getGlyphs({'Arial Unicode MS': [0x3066]}, (err, glyphs) => {
            expect(err).toBeFalsy();
            expect(glyphs['Arial Unicode MS'][0x3066].metrics.advance).toBe(0.5);
            done();
        });
    });

    test('GlyphManager caches locally generated glyphs', done => {

        const manager = createGlyphManager('sans-serif');
        const drawSpy = GlyphManager.TinySDF.prototype.draw = jest.fn().mockImplementation(() => {
            return {data: new Uint8ClampedArray(60 * 60)} as any;
        });

        // Katakana letter te
        manager.getGlyphs({'Arial Unicode MS': [0x30c6]}, (err, glyphs) => {
            expect(err).toBeFalsy();
            expect(glyphs['Arial Unicode MS'][0x30c6].metrics.advance).toBe(24);
            manager.getGlyphs({'Arial Unicode MS': [0x30c6]}, () => {
                expect(drawSpy).toHaveBeenCalledTimes(1);
                done();
            });
        });
    });
});
