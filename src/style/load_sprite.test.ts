import loadSprite from './load_sprite';
import {RGBAImage} from '../util/image';
import * as ajax from '../util/ajax';
import {RequestManager} from '../util/request_manager';
import fs from 'fs';
import path from 'path';
import {MapLibreRequestParameters} from '../util/ajax';

describe('loadSprite', () => {
    jest.spyOn(ajax, 'getJSON').mockImplementation((requestParameters: MapLibreRequestParameters) => {
        const responseMap = {
            'http://localhost:9966/test/unit/assets/sprite1.json': '../../test/unit/assets/sprite1.json',
        };

        return {
            response: new Promise(res => {
                const data = fs.readFileSync(path.join(__dirname, responseMap[requestParameters.url]));
                res({data});
            }),
            cancel: () => {}
        };
    });

    jest.spyOn(ajax, 'getImage').mockImplementation((requestParameters: MapLibreRequestParameters) => {
        return {
            response: new Promise(res => {
                const data = document.createElement('img');
                data.width = 1024; data.height = 824;

                res({data});
            }),
            cancel: () => {}
        };
    });

    test('backwards compatibility: single string is treated as a URL for the default sprite', done => {
        loadSprite('http://localhost:9966/test/unit/assets/sprite1', 1, (err, result) => {
            expect(err).toBeFalsy();

            expect(Object.keys(result)).toHaveLength(1);
            expect(Object.keys(result)[0]).toBe('default');

            Object.values(result['default']).forEach(styleImage => {
                expect(styleImage.data).toBeInstanceOf(RGBAImage);
            });

            done();
        });

        // expect(requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        // requests[0].setStatus(200);
        // requests[0].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json'));
        // requests[0].onload();
        //
        // expect(requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
        // requests[1].setStatus(200);
        // requests[1].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png')).buffer;
        // requests[1].onload();
    });

    test('array of objects support', done => {
        loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}, {id: 'sprite2', url: 'http://localhost:9966/test/unit/assets/sprite2'}], 1, (err, result) => {
            expect(err).toBeFalsy();

            // expect(transform).toHaveBeenCalledTimes(4);
            // expect(transform).toHaveBeenNthCalledWith(1, 'http://localhost:9966/test/unit/assets/sprite1.json', 'SpriteJSON');
            // expect(transform).toHaveBeenNthCalledWith(2, 'http://localhost:9966/test/unit/assets/sprite1.png', 'SpriteImage');
            // expect(transform).toHaveBeenNthCalledWith(3, 'http://localhost:9966/test/unit/assets/sprite2.json', 'SpriteJSON');
            // expect(transform).toHaveBeenNthCalledWith(4, 'http://localhost:9966/test/unit/assets/sprite2.png', 'SpriteImage');

            expect(Object.keys(result)).toHaveLength(2);
            expect(Object.keys(result)[0]).toBe('sprite1');
            expect(Object.keys(result)[1]).toBe('sprite2');

            Object.values(result['sprite1']).forEach(styleImage => {
                expect(styleImage.data).toBeInstanceOf(RGBAImage);
            });

            Object.values(result['sprite2']).forEach(styleImage => {
                expect(styleImage.data).toBeInstanceOf(RGBAImage);
            });

            done();
        });

        // expect(requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        // requests[0].setStatus(200);
        // requests[0].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json'));
        // requests[0].onload();
        //
        // expect(requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
        // requests[1].setStatus(200);
        // requests[1].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png')).buffer;
        // requests[1].onload();
        //
        // expect(requests[2].url).toBe('http://localhost:9966/test/unit/assets/sprite2.json');
        // requests[2].setStatus(200);
        // requests[2].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite2.json'));
        // requests[2].onload();
        //
        // expect(requests[3].url).toBe('http://localhost:9966/test/unit/assets/sprite2.png');
        // requests[3].setStatus(200);
        // requests[3].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite2.png')).buffer;
        // requests[3].onload();
    });

    test('error in callback', done => {

        loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}], 1, (err, result) => {
            expect(err).toBeTruthy();
            expect(result).toBeUndefined();

            done();
        });

        // expect(requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        // requests[0].setStatus(500);
        // requests[0].response = undefined;
        // requests[0].onload();
    });

    test('request canceling', done => {

        const cancelable = loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}], 1, () => {});

        setTimeout(() => {
            cancelable.cancel();

            // expect(requests[0].aborted).toBeTruthy();
            // expect(requests[1].aborted).toBeTruthy();

            done();
        });

        // setTimeout(() => {
        //     expect(requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1.json');
        //     requests[0].setStatus(200);
        //     requests[0].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json'));
        //     requests[0].onload();
        //
        //     expect(requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1.png');
        //     requests[1].setStatus(200);
        //     requests[1].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png')).buffer;
        //     requests[1].onload();
        // }, 10);
    });

    test('pixelRatio is respected', done => {

        loadSprite('http://localhost:9966/test/unit/assets/sprite1', 2, (err, result) => {
            expect(err).toBeFalsy();

            // expect(transform).toHaveBeenCalledTimes(2);
            // expect(transform).toHaveBeenNthCalledWith(1, 'http://localhost:9966/test/unit/assets/sprite1@2x.json', 'SpriteJSON');
            // expect(transform).toHaveBeenNthCalledWith(2, 'http://localhost:9966//unit/assets/sprite1@2x.png', 'SpriteImage');

            expect(Object.keys(result)).toHaveLength(1);
            expect(Object.keys(result)[0]).toBe('default');

            Object.values(result['default']).forEach(styleImage => {
                expect(styleImage.data).toBeInstanceOf(RGBAImage);
            });

            done();
        });

        // expect(requests[0].url).toBe('http://localhost:9966/test/unit/assets/sprite1@2x.json');
        // requests[0].setStatus(200);
        // requests[0].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.json'));
        // requests[0].onload();
        //
        // expect(requests[1].url).toBe('http://localhost:9966/test/unit/assets/sprite1@2x.png');
        // requests[1].setStatus(200);
        // requests[1].response = fs.readFileSync(path.join(__dirname, '../../test/unit/assets/sprite1.png')).buffer;
        // requests[1].onload();
    });
});
