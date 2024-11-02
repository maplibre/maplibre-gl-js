import fs from 'fs';
import path from 'path';
import {RequestManager} from '../util/request_manager';
import {loadSprite, normalizeSpriteURL} from './load_sprite';
import {type FakeServer, fakeServer} from 'nise';
import {bufferToArrayBuffer} from '../util/test/util';
import {ABORT_ERROR} from '../util/abort_error';
import * as util from '../util/util';

describe('normalizeSpriteURL', () => {
    test('concantenates path, ratio, and extension for non-mapbox:// scheme', () => {
        expect(
            normalizeSpriteURL('http://www.foo.com/bar', '@2x', '.png')
        ).toBe('http://www.foo.com/bar@2x.png');
    });

    test('concantenates path, ratio, and extension for file:/// scheme', () => {
        expect(
            normalizeSpriteURL('file:///path/to/bar', '@2x', '.png')
        ).toBe('file:///path/to/bar@2x.png');
    });

    test('normalizes non-mapbox:// scheme when query string exists', () => {
        expect(
            normalizeSpriteURL('http://www.foo.com/bar?fresh=true', '@2x', '.png')
        ).toBe('http://www.foo.com/bar@2x.png?fresh=true');
    });

    test('test relative URL', () => {
        expect(
            normalizeSpriteURL('/bar?fresh=true', '@2x', '.png')
        ).toBe('/bar@2x.png?fresh=true');
    });
});

describe('loadSprite', () => {

    let server: FakeServer;

    beforeEach(() => {
        jest.spyOn(util, 'arrayBufferToImageBitmap').mockImplementation(async (_data: ArrayBuffer) => {
            try {
                const img = await createImageBitmap(new ImageData(1024, 824));
                return img;
            } catch (e) {
                throw new Error(`Could not load image because of ${e.message}. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.`);
            }
        });
        global.fetch = null;
        server = fakeServer.create();
    });

    test('backwards compatibility: single string is treated as a URL for the default sprite', async () => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.json', fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json')).toString());
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.png', bufferToArrayBuffer(fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png'))));

        const promise = loadSprite('http://localhost:9966/test/unit/assets/sprite1', manager, 1, new AbortController());

        server.respond();

        const result = await promise;

        expect(transform).toHaveBeenCalledTimes(2);
        expect(transform).toHaveBeenNthCalledWith(1, 'http://localhost:9966/test/unit/assets/sprite1.json', 'SpriteJSON');
        expect(transform).toHaveBeenNthCalledWith(2, 'http://localhost:9966/test/unit/assets/sprite1.png', 'SpriteImage');

        expect(Object.keys(result)).toHaveLength(1);
        expect(Object.keys(result)[0]).toBe('default');

        Object.values(result['default']).forEach(styleImage => {
            expect(styleImage.spriteData).toBeTruthy();
            expect(styleImage.spriteData.context).toBeInstanceOf(CanvasRenderingContext2D);
        });

        expect(server.requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        expect(server.requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
    });

    test('transform of relative URL', async () => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url: `http://localhost:9966${url}`, type};
        });

        const manager = new RequestManager(transform);

        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.json', fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json')).toString());
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.png', bufferToArrayBuffer(fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png'))));

        const promise = loadSprite('/test/unit/assets/sprite1', manager, 1, new AbortController());

        server.respond();

        const result = await promise;

        expect(transform).toHaveBeenCalledTimes(2);
        expect(transform).toHaveBeenNthCalledWith(1, '/test/unit/assets/sprite1.json', 'SpriteJSON');
        expect(transform).toHaveBeenNthCalledWith(2, '/test/unit/assets/sprite1.png', 'SpriteImage');

        expect(Object.keys(result)).toHaveLength(1);
        expect(Object.keys(result)[0]).toBe('default');

        Object.values(result['default']).forEach(styleImage => {
            expect(styleImage.spriteData).toBeTruthy();
            expect(styleImage.spriteData.context).toBeInstanceOf(CanvasRenderingContext2D);
        });

        expect(server.requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        expect(server.requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
    });

    test('array of objects support', async () => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.json', fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json')).toString());
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.png', bufferToArrayBuffer(fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png'))));
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite2.json', fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite2.json')).toString());
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite2.png', bufferToArrayBuffer(fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite2.png'))));

        const promise = loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}, {id: 'sprite2', url: 'http://localhost:9966/test/unit/assets/sprite2'}], manager, 1, new AbortController());

        server.respond();

        const result = await promise;
        expect(transform).toHaveBeenCalledTimes(4);
        expect(transform).toHaveBeenNthCalledWith(1, 'http://localhost:9966/test/unit/assets/sprite1.json', 'SpriteJSON');
        expect(transform).toHaveBeenNthCalledWith(2, 'http://localhost:9966/test/unit/assets/sprite1.png', 'SpriteImage');
        expect(transform).toHaveBeenNthCalledWith(3, 'http://localhost:9966/test/unit/assets/sprite2.json', 'SpriteJSON');
        expect(transform).toHaveBeenNthCalledWith(4, 'http://localhost:9966/test/unit/assets/sprite2.png', 'SpriteImage');

        expect(Object.keys(result)).toHaveLength(2);
        expect(Object.keys(result)[0]).toBe('sprite1');
        expect(Object.keys(result)[1]).toBe('sprite2');

        Object.values(result['sprite1']).forEach(styleImage => {
            expect(styleImage.spriteData).toBeTruthy();
            expect(styleImage.spriteData.context).toBeInstanceOf(CanvasRenderingContext2D);
        });

        Object.values(result['sprite2']).forEach(styleImage => {
            expect(styleImage.spriteData).toBeTruthy();
            expect(styleImage.spriteData.context).toBeInstanceOf(CanvasRenderingContext2D);
        });

        expect(server.requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        expect(server.requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
        expect(server.requests[2].url).toBe('http://localhost:9966/test/unit/assets/sprite2.json');
        expect(server.requests[3].url).toBe('http://localhost:9966/test/unit/assets/sprite2.png');
    });

    test('server returns error', async () => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        server.respondWith((xhr) => xhr.respond(500));
        const promise = loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}], manager, 1, new AbortController());
        server.respond();

        await expect(promise).rejects.toThrow(/AJAXError.*500.*/);
        expect(server.requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
    });

    test('request canceling', async () => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.json', fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json')).toString());
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.png', bufferToArrayBuffer(fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png'))));

        const abortController = new AbortController();
        const promise = loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}], manager, 1, abortController);
        abortController.abort();

        expect((server.requests[0] as any).aborted).toBeTruthy();
        expect((server.requests[1] as any).aborted).toBeTruthy();

        await expect(promise).rejects.toThrow(ABORT_ERROR);
        server.respond();
        expect(server.requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        expect(server.requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
    });

    test('pixelRatio is respected', async () => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1@2x.json', fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json')).toString());
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1@2x.png', bufferToArrayBuffer(fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png'))));

        const promise = loadSprite('http://localhost:9966/test/unit/assets/sprite1', manager, 2, new AbortController());
        server.respond();

        const result = await promise;
        expect(transform).toHaveBeenCalledTimes(2);
        expect(transform).toHaveBeenNthCalledWith(1, 'http://localhost:9966/test/unit/assets/sprite1@2x.json', 'SpriteJSON');
        expect(transform).toHaveBeenNthCalledWith(2, 'http://localhost:9966/test/unit/assets/sprite1@2x.png', 'SpriteImage');

        expect(Object.keys(result)).toHaveLength(1);
        expect(Object.keys(result)[0]).toBe('default');

        Object.values(result['default']).forEach(styleImage => {
            expect(styleImage.spriteData).toBeTruthy();
            expect(styleImage.spriteData.context).toBeInstanceOf(CanvasRenderingContext2D);
        });

        expect(server.requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1@2x.json');
        expect(server.requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1@2x.png');
    });
});
