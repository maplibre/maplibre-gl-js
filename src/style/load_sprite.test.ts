import fs from 'fs';
import path from 'path';
import {RequestManager} from '../util/request_manager';
import {loadSprite} from './load_sprite';
import {type FakeServer, fakeServer} from 'nise';
import * as util from '../util/util';
import {bufferToArrayBuffer} from '../util/test/util';

describe('loadSprite', () => {

    let server: FakeServer;

    beforeEach(() => {
        jest.spyOn(util, 'arrayBufferToImageBitmap').mockImplementation((data: ArrayBuffer, callback: (err?: Error | null, image?: ImageBitmap | null) => void) => {
            createImageBitmap(new ImageData(1024, 824)).then((imgBitmap) => {
                callback(null, imgBitmap);
            }).catch((e) => {
                callback(new Error(`Could not load image because of ${e.message}. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.`));
            });
        });
        global.fetch = null;
        server = fakeServer.create();
    });

    test('backwards compatibility: single string is treated as a URL for the default sprite', done => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.json', fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json')).toString());
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.png', bufferToArrayBuffer(fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png'))));

        loadSprite('http://localhost:9966/test/unit/assets/sprite1', manager, 1, (err, result) => {
            expect(err).toBeFalsy();

            expect(transform).toHaveBeenCalledTimes(2);
            expect(transform).toHaveBeenNthCalledWith(1, 'http://localhost:9966/test/unit/assets/sprite1.json', 'SpriteJSON');
            expect(transform).toHaveBeenNthCalledWith(2, 'http://localhost:9966/test/unit/assets/sprite1.png', 'SpriteImage');

            expect(Object.keys(result)).toHaveLength(1);
            expect(Object.keys(result)[0]).toBe('default');

            Object.values(result['default']).forEach(styleImage => {
                expect(styleImage.spriteData).toBeTruthy();
                expect(styleImage.spriteData.context).toBeInstanceOf(CanvasRenderingContext2D);
            });

            done();
        });

        server.respond();

        expect(server.requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        expect(server.requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
    });

    test('array of objects support', done => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.json', fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json')).toString());
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.png', bufferToArrayBuffer(fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png'))));
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite2.json', fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite2.json')).toString());
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite2.png', bufferToArrayBuffer(fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite2.png'))));

        loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}, {id: 'sprite2', url: 'http://localhost:9966/test/unit/assets/sprite2'}], manager, 1, (err, result) => {
            expect(err).toBeFalsy();

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

            done();
        });

        server.respond();
        expect(server.requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        expect(server.requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
        expect(server.requests[2].url).toBe('http://localhost:9966/test/unit/assets/sprite2.json');
        expect(server.requests[3].url).toBe('http://localhost:9966/test/unit/assets/sprite2.png');
    });

    test('error in callback', done => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        server.respondWith((xhr) => xhr.respond(500));
        let last = false;
        loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}], manager, 1, (err, result) => {
            expect(err).toBeTruthy();
            expect(result).toBeUndefined();
            if (!last) {
                done();
                last = true;
            }
        });

        server.respond();
        expect(server.requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
    });

    test('request canceling', done => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.json', fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json')).toString());
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1.png', bufferToArrayBuffer(fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png'))));

        const cancelable = loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}], manager, 1, () => {});

        setTimeout(() => {
            cancelable.cancel();

            expect((server.requests[0] as any).aborted).toBeTruthy();
            expect((server.requests[1] as any).aborted).toBeTruthy();

            done();
        });

        setTimeout(() => {
            server.respond();
            expect(server.requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
            expect(server.requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
        }, 10);
    });

    test('pixelRatio is respected', done => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1@2x.json', fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json')).toString());
        server.respondWith('GET', 'http://localhost:9966/test/unit/assets/sprite1@2x.png', bufferToArrayBuffer(fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png'))));

        loadSprite('http://localhost:9966/test/unit/assets/sprite1', manager, 2, (err, result) => {
            expect(err).toBeFalsy();

            expect(transform).toHaveBeenCalledTimes(2);
            expect(transform).toHaveBeenNthCalledWith(1, 'http://localhost:9966/test/unit/assets/sprite1@2x.json', 'SpriteJSON');
            expect(transform).toHaveBeenNthCalledWith(2, 'http://localhost:9966/test/unit/assets/sprite1@2x.png', 'SpriteImage');

            expect(Object.keys(result)).toHaveLength(1);
            expect(Object.keys(result)[0]).toBe('default');

            Object.values(result['default']).forEach(styleImage => {
                expect(styleImage.spriteData).toBeTruthy();
                expect(styleImage.spriteData.context).toBeInstanceOf(CanvasRenderingContext2D);
            });

            done();
        });

        server.respond();
        expect(server.requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1@2x.json');
        expect(server.requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1@2x.png');
    });
});
