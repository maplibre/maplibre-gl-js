import fs from 'fs';
import path from 'path';
import {RequestManager} from '../util/request_manager';
import loadSprite from './load_sprite';
import {fakeXhr} from 'nise';
import * as util from '../util/util';

describe('loadSprite', () => {
    jest.spyOn(util, 'arrayBufferToImageBitmap').mockImplementation((data: ArrayBuffer, callback: (err?: Error | null, image?: ImageBitmap | null) => void) => {
        createImageBitmap(new ImageData(1024, 824)).then((imgBitmap) => {
            callback(null, imgBitmap);
        }).catch((e) => {
            callback(new Error(`Could not load image because of ${e.message}. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.`));
        });
    });
    global.fetch = null;

    test('backwards compatibility: single string is treated as a URL for the default sprite', done => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        const requests = [];
        fakeXhr.useFakeXMLHttpRequest().onCreate = (req) => { requests.push(req); };

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

        expect(requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        requests[0].setStatus(200);
        requests[0].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json'));
        requests[0].onload();

        expect(requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
        requests[1].setStatus(200);
        requests[1].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png')).buffer;
        requests[1].onload();
    });

    test('array of objects support', done => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        const requests = [];
        fakeXhr.useFakeXMLHttpRequest().onCreate = (req) => { requests.push(req); };

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

        expect(requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        requests[0].setStatus(200);
        requests[0].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json'));
        requests[0].onload();

        expect(requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
        requests[1].setStatus(200);
        requests[1].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png')).buffer;
        requests[1].onload();

        expect(requests[2].url).toBe('http://localhost:9966/test/unit/assets/sprite2.json');
        requests[2].setStatus(200);
        requests[2].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite2.json'));
        requests[2].onload();

        expect(requests[3].url).toBe('http://localhost:9966/test/unit/assets/sprite2.png');
        requests[3].setStatus(200);
        requests[3].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite2.png')).buffer;
        requests[3].onload();
    });

    test('error in callback', done => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        const requests = [];
        fakeXhr.useFakeXMLHttpRequest().onCreate = (req) => { requests.push(req); };

        loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}], manager, 1, (err, result) => {
            expect(err).toBeTruthy();
            expect(result).toBeUndefined();

            done();
        });

        expect(requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        requests[0].setStatus(500);
        requests[0].response = undefined;
        requests[0].onload();
    });

    test('request canceling', done => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        const requests = [];
        fakeXhr.useFakeXMLHttpRequest().onCreate = (req) => { requests.push(req); };

        const cancelable = loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}], manager, 1, () => {});

        setTimeout(() => {
            cancelable.cancel();

            expect(requests[0].aborted).toBeTruthy();
            expect(requests[1].aborted).toBeTruthy();

            done();
        });

        setTimeout(() => {
            expect(requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
            requests[0].setStatus(200);
            requests[0].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json'));
            requests[0].onload();

            expect(requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
            requests[1].setStatus(200);
            requests[1].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png')).buffer;
            requests[1].onload();
        }, 10);
    });

    test('pixelRatio is respected', done => {
        const transform = jest.fn().mockImplementation((url, type) => {
            return {url, type};
        });

        const manager = new RequestManager(transform);

        const requests = [];
        fakeXhr.useFakeXMLHttpRequest().onCreate = (req) => { requests.push(req); };

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

        expect(requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1@2x.json');
        requests[0].setStatus(200);
        requests[0].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json'));
        requests[0].onload();

        expect(requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1@2x.png');
        requests[1].setStatus(200);
        requests[1].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png')).buffer;
        requests[1].onload();
    });
});
