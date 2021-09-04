import {test} from '../../util/test';
import {RequestManager} from '../../../rollup/build/tsc/util/request_manager';

test('RequestManager', (t) => {
    t.test('.normalizeSpriteURL', (t) => {
        t.test('concantenates path, ratio, and extension for non-mapbox:// scheme', (t) => {
            t.equal(new RequestManager().normalizeSpriteURL('http://www.foo.com/bar', '@2x', '.png'), 'http://www.foo.com/bar@2x.png');
            t.end();
        });

        t.test('concantenates path, ratio, and extension for file:/// scheme', (t) => {
            t.equal(new RequestManager().normalizeSpriteURL('file:///path/to/bar', '@2x', '.png'), 'file:///path/to/bar@2x.png');
            t.end();
        });

        t.test('normalizes non-mapbox:// scheme when query string exists', (t) => {
            t.equal(new RequestManager().normalizeSpriteURL('http://www.foo.com/bar?fresh=true', '@2x', '.png'), 'http://www.foo.com/bar@2x.png?fresh=true');
            t.end();
        });
        t.end();
    });

    t.end();
});
