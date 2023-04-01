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
    const format = pixelRatio > 1 ? '@2x' : '';

    const combinedRequestsMap: {[requestUrl: string]: Cancelable} = {};
    const jsonsMap: {[id: string]: any} = {};
    const imagesMap: {[id: string]: (HTMLImageElement | ImageBitmap)} = {};

    for (const {id, url} of spriteArray) {
        const jsonRequestParameters = requestManager.transformRequest(requestManager.normalizeSpriteURL(url, format, '.json'), ResourceType.SpriteJSON);
        combinedRequestsMap[jsonRequestParameters.url] = getJSON(jsonRequestParameters, (err?: Error | null, data?: any | null) => {
            sharedCallbackProcessing(id, jsonRequestParameters.url, jsonsMap, err, data);
        });

        const imageRequestParameters = requestManager.transformRequest(requestManager.normalizeSpriteURL(url, format, '.png'), ResourceType.SpriteImage);
        combinedRequestsMap[imageRequestParameters.url] = ImageRequest.getImage(imageRequestParameters, (err, img) => {
            sharedCallbackProcessing(id, imageRequestParameters.url, imagesMap, err, img);
        });
    }

    function sharedCallbackProcessing(id: string, url: string, dataMap:{[id: string]: any}, err?: Error, data?: any) {
        delete combinedRequestsMap[url];
        if (err) {
            callback(err);
        } else {
            dataMap[id] = data;
            maybeComplete();
        }
    }

    function maybeComplete() {
        const jsonsLength = Object.values(jsonsMap).length;
        const imagesLength = Object.values(imagesMap).length;

        if (spriteArray.length === jsonsLength && jsonsLength === imagesLength) {
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

            callback(null, result);
        }
    }

    return {
        cancel() {
            for (const requst of Object.values(combinedRequestsMap)) {
                requst.cancel();
            }
        }
    };
}
