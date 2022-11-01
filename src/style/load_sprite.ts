import {getJSON, getImage, ResourceType} from '../util/ajax';

import browser from '../util/browser';
import {RGBAImage} from '../util/image';

import type {StyleImage} from './style_image';
import type {RequestManager} from '../util/request_manager';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';

export default function loadSprite(
    baseURL: string,
    requestManager: RequestManager,
    pixelRatio: number,
    callback: Callback<{[spriteName: string]: {[id: string]: StyleImage}}>
): Cancelable {
    let error;
    const format = pixelRatio > 1 ? '@2x' : '';

    const baseURLs = baseURL.split('\n');
    const jsonRequests: Cancelable[] = [];
    const imageRequests: Cancelable[] = [];

    const jsonsMap: {[baseURL: string]: any} = {};
    const imagesMap: {[baseURL:string]: (HTMLImageElement | ImageBitmap)} = {};

    for (const spriteNameAndBaseURL of baseURLs) {
        // TODO: if something's missing in the resulting array, emit an error
        const [spriteName, baseURL] = spriteNameAndBaseURL.split('\t');

        const newJsonRequestsLength = jsonRequests.push(getJSON(requestManager.transformRequest(requestManager.normalizeSpriteURL(baseURL, format, '.json'), ResourceType.SpriteJSON), (err?: Error | null, data?: any | null) => {
            jsonRequests.splice(newJsonRequestsLength, 1);
            if (!error) {
                error = err;
                jsonsMap[spriteName] = data;
                maybeComplete();
            }
        }));

        const newImageRequestsLength = imageRequests.push(getImage(requestManager.transformRequest(requestManager.normalizeSpriteURL(baseURL, format, '.png'), ResourceType.SpriteImage), (err, img) => {
            imageRequests.splice(newImageRequestsLength, 1);
            if (!error) {
                error = err;
                imagesMap[spriteName] = img;
                maybeComplete();
            }
        }));
    }

    function maybeComplete() {
        const jsonsLength = Object.values(jsonsMap).length;
        const imagesLength = Object.values(imagesMap).length;

        if (error) {
            callback(error);
        } else if (baseURLs.length === jsonsLength && jsonsLength === imagesLength) {

            const result = {};

            for (const spriteName in jsonsMap) {
                result[spriteName] = {};

                const imageData = browser.getImageData(imagesMap[spriteName]);
                const json = jsonsMap[spriteName];

                for (const id in json) {
                    const {width, height, x, y, sdf, pixelRatio, stretchX, stretchY, content} = json[id];
                    const data = new RGBAImage({width, height});
                    RGBAImage.copy(imageData, data, {x, y}, {x: 0, y: 0}, {width, height});
                    result[spriteName][id] = {data, pixelRatio, sdf, stretchX, stretchY, content};
                }
            }

            callback(null, result);
        }
    }

    return {
        cancel() {
            // if (jsonRequest) {
            //     jsonRequest.cancel();
            //     jsonRequest = null;
            // }
            // if (imageRequest) {
            //     imageRequest.cancel();
            //     imageRequest = null;
            // }
        }
    };
}
