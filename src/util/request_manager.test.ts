import {RequestManager} from './request_manager';

describe('RequestManager.normalizeSpriteURL', () => {
    test('concantenates path, ratio, and extension for non-mapbox:// scheme', () => {
        expect(
            new RequestManager().normalizeSpriteURL('http://www.foo.com/bar', '@2x', '.png')
        ).toBe('http://www.foo.com/bar@2x.png');
    });

    test('concantenates path, ratio, and extension for file:/// scheme', () => {
        expect(
            new RequestManager().normalizeSpriteURL('file:///path/to/bar', '@2x', '.png')
        ).toBe('file:///path/to/bar@2x.png');
    });

    test('normalizes non-mapbox:// scheme when query string exists', () => {
        expect(
            new RequestManager().normalizeSpriteURL('http://www.foo.com/bar?fresh=true', '@2x', '.png')
        ).toBe('http://www.foo.com/bar@2x.png?fresh=true');
    });
});
