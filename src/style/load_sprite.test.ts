import loadSprite from './load_sprite';
import {RGBAImage} from '../util/image';
import * as ajax from '../util/ajax';
import {readFileSync} from 'fs';
import path from 'path';
import {MapLibreRequestParameters} from '../util/ajax';

describe('loadSprite', () => {
    jest.spyOn(ajax, 'getJSON').mockImplementation((requestParameters: MapLibreRequestParameters) => {
        const responseMap = {
            'http://localhost:9966/test/unit/assets/sprite1.json': '../../test/unit/assets/sprite1.json',
            'http://localhost:9966/test/unit/assets/sprite2.json': '../../test/unit/assets/sprite2.json',
            'http://localhost:9966/test/unit/assets/sprite3@2x.json': '../../test/unit/assets/sprite3@2x.json',
        };

        return {
            response: new Promise((res, rej) => {
                try {
                    const data = JSON.parse(readFileSync(path.join(__dirname, responseMap[requestParameters.url]), 'utf-8'));
                    res({data});
                } catch {
                    rej(new Error('failed'));
                }
            }),
            cancel: () => {}
        };
    });

    let forceFailGetImage = false;

    jest.spyOn(ajax, 'getImage').mockImplementation(() => {
        return {
            response: new Promise((res, rej) => {
                const data = document.createElement('img');
                data.width = 1024; data.height = 824;

                if (forceFailGetImage) {
                    rej(new Error('failed'));
                } else {
                    res({data});
                }
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
    });

    test('array of objects support', done => {
        loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}, {id: 'sprite2', url: 'http://localhost:9966/test/unit/assets/sprite2'}], 1, (err, result) => {
            expect(err).toBeFalsy();

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
    });

    test('error in callback (json)', done => {
        loadSprite([{id: 'sprite1', url: 'https://nonexisting.url'}], 1, (err, result) => {
            expect(err).toBeInstanceOf(Error);
            expect(result).toBeUndefined();

            done();
        });
    });

    test('error in callback (image)', done => {
        forceFailGetImage = true;

        loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}], 1, (err, result) => {
            expect(err).toBeInstanceOf(Error);
            expect(result).toBeUndefined();

            done();
        });

        forceFailGetImage = false;
    });

    test('request canceling', () => {
        const callback = jest.fn(() => {});
        const cancelable = loadSprite([{id: 'sprite1', url: 'http://localhost:9966/test/unit/assets/sprite1'}], 1, callback);
        cancelable.cancel();

        expect(callback).not.toHaveBeenCalled();
    });

    test('pixelRatio is respected', done => {

        loadSprite('http://localhost:9966/test/unit/assets/sprite3', 2, (err, result) => {
            expect(err).toBeFalsy();

            expect(Object.keys(result)).toHaveLength(1);
            expect(Object.keys(result)[0]).toBe('default');

            expect(Object.keys(result.default)).toHaveLength(1);

            done();
        });
    });
});
