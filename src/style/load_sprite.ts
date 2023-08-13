import {getJSON} from '../util/ajax';
import {ImageRequest} from '../util/image_request';
import {ResourceType} from '../util/request_manager';

import {browser} from '../util/browser';
import {coerceSpriteToArray} from '../util/style';

import type {SpriteSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {StyleImage} from './style_image';
import type {RequestManager} from '../util/request_manager';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';

export function loadSprite(
    originalSprite: SpriteSpecification,
    requestManager: RequestManager,
    pixelRatio: number,
    callback: Callback<{[spriteName: string]: {[id: string]: StyleImage}}>
): Cancelable {
    const spriteArray = coerceSpriteToArray(originalSprite);
    const spriteArrayLength = spriteArray.length;
    const format = pixelRatio > 1 ? '@2x' : '';

    const combinedRequestsMap: {[requestKey: string]: Cancelable} = {};
    const jsonsMap: {[id: string]: any} = {};
    const imagesMap: {[id: string]: (HTMLImageElement | ImageBitmap)} = {};

    for (const {id, url} of spriteArray) {
        const jsonRequestParameters = requestManager.transformRequest(requestManager.normalizeSpriteURL(url, format, '.json'), ResourceType.SpriteJSON);
        const jsonRequestKey = `${id}_${jsonRequestParameters.url}`; // use id_url as requestMap key to make sure it is unique
        combinedRequestsMap[jsonRequestKey] = getJSON(jsonRequestParameters, (err?: Error | null, data?: any | null) => {
            delete combinedRequestsMap[jsonRequestKey];
            jsonsMap[id] = data;
            doOnceCompleted(callback, jsonsMap, imagesMap, err, spriteArrayLength);
        });

        const imageRequestParameters = requestManager.transformRequest(requestManager.normalizeSpriteURL(url, format, '.png'), ResourceType.SpriteImage);
        const imageRequestKey = `${id}_${imageRequestParameters.url}`; // use id_url as requestMap key to make sure it is unique
        combinedRequestsMap[imageRequestKey] = ImageRequest.getImage(imageRequestParameters, (err, img) => {
            delete combinedRequestsMap[imageRequestKey];
            imagesMap[id] = img;
            doOnceCompleted(callback, jsonsMap, imagesMap, err, spriteArrayLength);
        });
    }

    return {
        cancel() {
            for (const requst of Object.values(combinedRequestsMap)) {
                requst.cancel();
            }
        }
    };
}

/**
 * @param callbackFunc - the callback function (both erro and success)
 * @param jsonsMap - JSON data map
 * @param imagesMap - image data map
 * @param err - error object
 * @param expectedResultCounter - number of expected JSON or Image results when everything is finished, respectively.
 */
function doOnceCompleted(
    callbackFunc:Callback<{[spriteName: string]: {[id: string]: StyleImage}}>,
    jsonsMap:{[id: string]: any},
    imagesMap:{[id: string]: (HTMLImageElement | ImageBitmap)},
    err: Error,
    expectedResultCounter: number): void {

    if (err) {
        callbackFunc(err);
        return;
    }

    if (expectedResultCounter !== Object.values(jsonsMap).length || expectedResultCounter !==  Object.values(imagesMap).length) {
        // not done yet, nothing to do
        return;
    }

    const result = {} as {[spriteName: string]: {[id: string]: StyleImage}};
    for (const spriteName in jsonsMap) {
        result[spriteName] = {};

        const context = browser.getImageCanvasContext(imagesMap[spriteName]);
        const json = jsonsMap[spriteName];

        for (const id in json) {
            const {width, height, x, y, sdf, pixelRatio, stretchX, stretchY, content} = json[id];
            const spriteData = {width, height, x, y, context};
            result[spriteName][id] = {data: null, pixelRatio, sdf, stretchX, stretchY, content, spriteData};
        }
    }

    callbackFunc(null, result);
}
