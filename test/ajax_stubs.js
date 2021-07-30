
import {PNG} from 'pngjs';
import request from 'request';
const cache = {};

// HM TODO: remove this file when it is no longer needed.

/**
 * The type of a resource.
 * @private
 * @readonly
 * @enum {string}
 */
const ResourceType = {
    Unknown: 'Unknown',
    Style: 'Style',
    Source: 'Source',
    Tile: 'Tile',
    Glyphs: 'Glyphs',
    SpriteImage: 'SpriteImage',
    SpriteJSON: 'SpriteJSON',
    Image: 'Image'
};
export {ResourceType};

if (typeof Object.freeze == 'function') {
    Object.freeze(ResourceType);
}

function cached(data, callback) {
    setImmediate(() => {
        callback(null, data);
    });
}

export const getReferrer = () => undefined;

export const getJSON = function({url}, callback) {
    if (cache[url]) return cached(cache[url], callback);
    return request(url, (error, response, body) => {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            let data;
            try {
                data = JSON.parse(body);
            } catch (err) {
                return callback(err);
            }
            cache[url] = data;
            callback(null, data);
        } else {
            callback(error || new Error(response.statusCode));
        }
    });
};

export const getArrayBuffer = function({url}, callback) {
    if (cache[url]) return cached(cache[url], callback);
    return request({url, encoding: null}, (error, response, body) => {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            cache[url] = body;
            callback(null, body);
        } else {
            if (!error) error = {status: +response.statusCode};
            callback(error);
        }
    });
};

export const makeRequest = getArrayBuffer;

export const postData = function({url, body}, callback) {
    return request.post(url, body, (error, response, body) => {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            callback(null, body);
        } else {
            callback(error || new Error(response.statusCode));
        }
    });
};

export const getImage = function({url}, callback) {
    if (cache[url]) return cached(cache[url], callback);
    return request({url, encoding: null}, (error, response, body) => {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            new PNG().parse(body, (err, png) => {
                if (err) return callback(err);
                cache[url] = png;
                callback(null, png);
            });
        } else {
            callback(error || {status: response.statusCode});
        }
    });
};

// Hack: since node doesn't have any good video codec modules, just grab a png with
// the first frame and fake the video API.
export const getVideo = function(urls, callback) {
    return request({url: urls[0], encoding: null}, (error, response, body) => {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            new PNG().parse(body, (err, png) => {
                if (err) return callback(err);
                callback(null, {
                    readyState: 4, // HAVE_ENOUGH_DATA
                    addEventListener() {},
                    play() {},
                    width: png.width,
                    height: png.height,
                    data: png.data
                });
            });
        } else {
            callback(error || new Error(response.statusCode));
        }
    });
};
