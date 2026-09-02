import {Interpolate, interpolates} from '@maplibre/maplibre-gl-style-spec';
import {clamp} from '../util/util.ts';
import {EvaluationParameters} from '../style/evaluation_parameters.ts';

import type {PropertyValue, PossiblyEvaluatedPropertyValue} from '../style/properties.ts';
import type {InterpolationType, StylePropertyExpression} from '@maplibre/maplibre-gl-style-spec';

const MAX_GLYPH_ICON_SIZE = 255;
const SIZE_PACK_FACTOR = 128;
const MAX_PACKED_SIZE: number = MAX_GLYPH_ICON_SIZE * SIZE_PACK_FACTOR;

export {getSizeData, evaluateSizeForFeature, evaluateSizeForZoom, SIZE_PACK_FACTOR, MAX_GLYPH_ICON_SIZE, MAX_PACKED_SIZE};

/**
 * Per-bucket data for `text-size` or `icon-size`. Built in the worker, so it holds
 * plain transferable values, not the size expression itself.
 */
export type SizeData = {
    kind: 'constant';
    layoutSize: number;
} | {
    kind: 'source';
} | {
    kind: 'camera';
    zoomStops: number[];
    sizes: number[];
    layoutSize: number;
    interpolationType: InterpolationType;
} | {
    kind: 'composite';
    minZoom: number;
    maxZoom: number;
    interpolationType: InterpolationType;
};

type CameraSizeData = Extract<SizeData, {kind: 'camera'}>;
type CompositeSizeData = Extract<SizeData, {kind: 'composite'}>;
type CameraSizeExpression = Extract<StylePropertyExpression, {kind: 'camera'}>;

export type EvaluatedZoomSize = {uSizeT: number; uSize: number};

/**
 * Gets the bucket-level size data the painter needs to set symbol size uniforms.
 */
function getSizeData(
    tileZoom: number,
    value: PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>
): SizeData {
    const {expression} = value;

    if (expression.kind === 'constant') {
        const layoutSize = expression.evaluate(new EvaluationParameters(tileZoom + 1));
        return {kind: 'constant', layoutSize};

    } else if (expression.kind === 'source') {
        return {kind: 'source'};

    } else if (expression.kind === 'composite') {
        const {minZoom, maxZoom} = getCoveringZoomStops(expression.zoomStops, tileZoom);
        return {kind: 'composite', minZoom, maxZoom, interpolationType: expression.interpolationType};

    } else {
        const sizes = evaluateSizesAtZoomStops(expression);
        const layoutSize = expression.evaluate(new EvaluationParameters(tileZoom + 1));
        return {kind: 'camera', zoomStops: expression.zoomStops, sizes, layoutSize, interpolationType: expression.interpolationType};
    }
}

/**
 * Finds the pair of zoom stops covering `[tileZoom, tileZoom + 1]`. A composite size
 * bakes each feature's size at these two zooms into the vertex data.
 */
function getCoveringZoomStops(zoomStops: number[], tileZoom: number): {minZoom: number; maxZoom: number} {
    let lower = 0;
    while (lower < zoomStops.length && zoomStops[lower] <= tileZoom) lower++;
    lower = Math.max(0, lower - 1);
    let upper = lower;
    while (upper < zoomStops.length && zoomStops[upper] < tileZoom + 1) upper++;
    upper = Math.min(zoomStops.length - 1, upper);
    return {minZoom: zoomStops[lower], maxZoom: zoomStops[upper]};
}

/**
 * Evaluates a camera size expression at each of its zoom stops. A step's first stop is
 * `-Infinity`, so its base value is sampled just below the second stop instead.
 */
function evaluateSizesAtZoomStops(expression: CameraSizeExpression): number[] {
    return expression.zoomStops.map((zoomStop) => expression.evaluate(
        new EvaluationParameters(zoomStop === -Infinity ? expression.zoomStops[1] - 1 : zoomStop)));
}

function evaluateSizeForFeature(sizeData: SizeData,
    {
        uSize,
        uSizeT
    }: {
        uSize: number;
        uSizeT: number;
    },
    {
        lowerSize,
        upperSize
    }: {
        lowerSize: number;
        upperSize: number;
    }): number {
    if (sizeData.kind === 'source') {
        return lowerSize / SIZE_PACK_FACTOR;
    } else if (sizeData.kind === 'composite') {
        return interpolates.number(lowerSize / SIZE_PACK_FACTOR, upperSize / SIZE_PACK_FACTOR, uSizeT);
    }
    return uSize;
}

/**
 * Computes a bucket's size uniforms at the zoom being drawn, which on a retained tile
 * differs from the zoom the bucket was built for.
 */
function evaluateSizeForZoom(sizeData: SizeData, zoom: number): EvaluatedZoomSize {
    let uSizeT = 0;
    let uSize = 0;

    if (sizeData.kind === 'constant') {
        uSize = sizeData.layoutSize;
    } else if (sizeData.kind === 'camera') {
        uSize = evaluateCameraSize(sizeData, zoom);
    } else if (sizeData.kind === 'composite') {
        uSizeT = evaluateCompositeInterpolationFactor(sizeData, zoom);
    }

    return {uSizeT, uSize};
}

/**
 * Evaluates a camera size at the drawn zoom, interpolating between the stops around it.
 * Capped at `layoutSize`, the size the tile's collision boxes were built for: drawing
 * larger than that would let labels overlap.
 */
function evaluateCameraSize({zoomStops, sizes, layoutSize, interpolationType}: CameraSizeData, zoom: number): number {
    let lower = zoomStops.length - 1;
    while (lower > 0 && zoomStops[lower] > zoom) lower--;
    const upper = Math.min(lower + 1, zoomStops.length - 1);

    const t = !interpolationType ? 0 : clamp(
        Interpolate.interpolationFactor(interpolationType, zoom, zoomStops[lower], zoomStops[upper]), 0, 1);
    return Math.min(interpolates.number(sizes[lower], sizes[upper], t), layoutSize);
}

/**
 * Computes how far the drawn zoom sits between a composite size's two stops, clamped
 * into `[0, 1]`: each feature only stores its size at those two stops, so all the
 * renderer can do is blend between them.
 */
function evaluateCompositeInterpolationFactor({interpolationType, minZoom, maxZoom}: CompositeSizeData, zoom: number): number {
    return !interpolationType ? 0 : clamp(
        Interpolate.interpolationFactor(interpolationType, zoom, minZoom, maxZoom), 0, 1);
}
