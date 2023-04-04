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
    const sprite = coerceSpriteToArray(originalSprite);
    const format = pixelRatio > 1 ? '@2x' : '';

    let error;
    const jsonRequests: Cancelable[] = [];
    const imageRequests: Cancelable[] = [];

    const jsonsMap: {[baseURL: string]: any} = {};
    const imagesMap: {[baseURL:string]: (HTMLImageElement | ImageBitmap)} = {};

    for (const {id, url} of sprite) {
        // eslint-disable-next-line no-loop-func
        const newJsonRequestsLength = jsonRequests.push(getJSON(requestManager.transformRequest(requestManager.normalizeSpriteURL(url, format, '.json'), ResourceType.SpriteJSON), (err?: Error | null, data?: any | null) => {
            jsonRequests.splice(newJsonRequestsLength, 1);
            if (!error) {
                error = err;
                jsonsMap[id] = data;
                maybeComplete();
            }
        }));

        // eslint-disable-next-line no-loop-func
        const newImageRequestsLength = imageRequests.push(ImageRequest.getImage(requestManager.transformRequest(requestManager.normalizeSpriteURL(url, format, '.png'), ResourceType.SpriteImage), (err, img) => {
            imageRequests.splice(newImageRequestsLength, 1);
            if (!error) {
                error = err;
                imagesMap[id] = img;
                maybeComplete();
            }
        }));
    }

    function maybeComplete() {
        const jsonsLength = Object.values(jsonsMap).length;
        const imagesLength = Object.values(imagesMap).length;

        if (error) {
            callback(error);
        } else if (sprite.length === jsonsLength && jsonsLength === imagesLength) {
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
            if (jsonRequests.length) {
                for (const jsonRequest of jsonRequests) {
                    jsonRequest.cancel();
                    jsonRequests.splice(jsonRequests.indexOf(jsonRequest), 1);
                }
            }

            if (imageRequests.length) {
                for (const imageRequest of imageRequests) {
                    imageRequest.cancel();
                    imageRequests.splice(imageRequests.indexOf(imageRequest), 1);
                }
            }
        }
    };
}
