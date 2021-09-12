import {test} from '../../util/test';
import {RequestManager} from '../../../rollup/build/tsc/util/request_manager';

test('RequestManager', (t) => {
    t.test('.normalizeSpriteURL', (t) => {
        t.test('concantenates path, ratio, and extension for non-mapbox:// scheme', (t) => {
            expect(
                new RequestManager().normalizeSpriteURL('http://www.foo.com/bar', '@2x', '.png')
            ).toBe('http://www.foo.com/bar@2x.png');
            t.end();
        });

        t.test('concantenates path, ratio, and extension for file:/// scheme', (t) => {
            expect(
                new RequestManager().normalizeSpriteURL('file:///path/to/bar', '@2x', '.png')
            ).toBe('file:///path/to/bar@2x.png');
            t.end();
        });

        t.test('normalizes non-mapbox:// scheme when query string exists', (t) => {
            expect(
                new RequestManager().normalizeSpriteURL('http://www.foo.com/bar?fresh=true', '@2x', '.png')
            ).toBe('http://www.foo.com/bar@2x.png?fresh=true');
            t.end();
        });
        t.end();
    });

    t.end();
});
