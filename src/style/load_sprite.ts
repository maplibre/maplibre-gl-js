import {getJSON} from '../util/ajax';
import ImageRequest from '../util/image_request';
import {ResourceType} from '../util/request_manager';

import browser from '../util/browser';
import {coerceSpriteToArray} from '../util/style';

import type {SpriteSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {StyleImage} from './style_image';
import type {RequestManager} from '../util/request_manager';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';

export default function loadSprite(
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
            maybeComplete(callback, id, ResourceType.SpriteJSON, jsonsMap, imagesMap, err, data, spriteArrayLength);
        });

        const imageRequestParameters = requestManager.transformRequest(requestManager.normalizeSpriteURL(url, format, '.png'), ResourceType.SpriteImage);
        const imageRequestKey = `${id}_${imageRequestParameters.url}`; // use id_url as requestMap key to make sure it is unique
        combinedRequestsMap[imageRequestKey] = ImageRequest.getImage(imageRequestParameters, (err, img) => {
            delete combinedRequestsMap[imageRequestKey];
            maybeComplete(callback, id, ResourceType.SpriteImage, jsonsMap, imagesMap, err, img, spriteArrayLength);
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
 * @param id - id of the sprite whose callback has just been received
 * @param resourceType - ResourceType enum to indicate which result has just been received
 * @param jsonsMap - JSON data map
 * @param imagesMap - image data map
 * @param err - error object
 * @param data - data object returned by JSON or image request
 * @param expectedResultCounter - number of expected JSON or Image results when everything is finished, respectively.
 */
function maybeComplete(
    callbackFunc:Callback<{[spriteName: string]: {[id: string]: StyleImage}}>,
    id: string,
    resourceType: ResourceType,
    jsonsMap:{[id: string]: any},
    imagesMap:{[id: string]: (HTMLImageElement | ImageBitmap)},
    err: Error,
    data: any,
    expectedResultCounter: number): void {

    if (err) {
        callbackFunc(err);
        return;
    }
    if (resourceType === ResourceType.SpriteJSON) {
        jsonsMap[id] = data;
    } else if (resourceType === ResourceType.SpriteImage) {
        imagesMap[id] = data;
    }

    const jsonsLength = Object.values(jsonsMap).length;
    const imagesLength = Object.values(imagesMap).length;

    if (expectedResultCounter === jsonsLength && jsonsLength === imagesLength) {
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
}
