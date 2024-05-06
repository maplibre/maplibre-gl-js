import {GetResourceResponse, getJSON} from '../util/ajax';
import {ImageRequest} from '../util/image_request';
import {ResourceType} from '../util/request_manager';

import {browser} from '../util/browser';
import {coerceSpriteToArray} from '../util/style';

import type {SpriteSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {SpriteJSON, StyleImage} from './style_image';
import type {RequestManager} from '../util/request_manager';

export type LoadSpriteResult = {
    [spriteName: string]: {
        [id: string]: StyleImage;
    };
}

export function normalizeSpriteURL(url: string, format: string, extension: string): string {
    const split = url.split('?');
    split[0] += `${format}${extension}`;
    return split.join('?');
}

export async function loadSprite(
    originalSprite: SpriteSpecification,
    requestManager: RequestManager,
    pixelRatio: number,
    abortController: AbortController,
): Promise<LoadSpriteResult> {
    const spriteArray = coerceSpriteToArray(originalSprite);
    const format = pixelRatio > 1 ? '@2x' : '';

    const jsonsMap: {[id: string]: Promise<GetResourceResponse<SpriteJSON>>} = {};
    const imagesMap: {[id: string]: Promise<GetResourceResponse<HTMLImageElement | ImageBitmap>>} = {};

    for (const {id, url} of spriteArray) {
        const jsonRequestParameters = requestManager.transformRequest(normalizeSpriteURL(url, format, '.json'), ResourceType.SpriteJSON);
        jsonsMap[id] = getJSON<SpriteJSON>(jsonRequestParameters, abortController);

        const imageRequestParameters = requestManager.transformRequest(normalizeSpriteURL(url, format, '.png'), ResourceType.SpriteImage);
        imagesMap[id] = ImageRequest.getImage(imageRequestParameters, abortController);
    }

    await Promise.all([...Object.values(jsonsMap), ...Object.values(imagesMap)]);
    return doOnceCompleted(jsonsMap, imagesMap);
}

/**
 * @param jsonsMap - JSON data map
 * @param imagesMap - image data map
 */
async function doOnceCompleted(
    jsonsMap:{[id: string]: Promise<GetResourceResponse<SpriteJSON>>},
    imagesMap:{[id: string]: Promise<GetResourceResponse<HTMLImageElement | ImageBitmap>>}): Promise<LoadSpriteResult> {

    const result = {} as {[spriteName: string]: {[id: string]: StyleImage}};
    for (const spriteName in jsonsMap) {
        result[spriteName] = {};

        const context = browser.getImageCanvasContext((await imagesMap[spriteName]).data);
        const json = (await jsonsMap[spriteName]).data;

        for (const id in json) {
            const {width, height, x, y, sdf, pixelRatio, stretchX, stretchY, content, textFitWidth, textFitHeight} = json[id];
            const spriteData = {width, height, x, y, context};
            result[spriteName][id] = {data: null, pixelRatio, sdf, stretchX, stretchY, content, textFitWidth, textFitHeight, spriteData};
        }
    }

    return result;
}
