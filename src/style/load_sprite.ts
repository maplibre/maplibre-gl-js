import {getJSON, getImage, ResourceType} from '../util/ajax';

import browser from '../util/browser';

import type {StyleImage} from './style_image';
import type {RequestManager} from '../util/request_manager';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';

export default function loadSprite(
    baseURL: string,
    requestManager: RequestManager,
    pixelRatio: number,
    callback: Callback<{[_: string]: StyleImage}>
): Cancelable {
    let json: any, image, error;
    const format = pixelRatio > 1 ? '@2x' : '';

    let jsonRequest = getJSON(requestManager.transformRequest(requestManager.normalizeSpriteURL(baseURL, format, '.json'), ResourceType.SpriteJSON), (err?: Error | null, data?: any | null) => {
        jsonRequest = null;
        if (!error) {
            error = err;
            json = data;
            maybeComplete();
        }
    });

    let imageRequest = getImage(requestManager.transformRequest(requestManager.normalizeSpriteURL(baseURL, format, '.png'), ResourceType.SpriteImage), (err, img) => {
        imageRequest = null;
        if (!error) {
            error = err;
            image = img;
            maybeComplete();
        }
    });

    function maybeComplete() {
        if (error) {
            callback(error);
        } else if (json && image) {
            const context = browser.getImageCanvasContext(image);
            const result = {};

            for (const id in json) {
                const {width, height, x, y, sdf, pixelRatio, stretchX, stretchY, content} = json[id];                
                result[id] = {data: null, pixelRatio, sdf, stretchX, stretchY, content, width, height, context, x , y};
            }

            callback(null, result);
        }
    }

    return {
        cancel() {
            if (jsonRequest) {
                jsonRequest.cancel();
                jsonRequest = null;
            }
            if (imageRequest) {
                imageRequest.cancel();
                imageRequest = null;
            }
        }
    };
}
