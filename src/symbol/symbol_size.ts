import {Interpolate, interpolates} from '@maplibre/maplibre-gl-style-spec';
import {clamp} from '../util/util.ts';
import {EvaluationParameters} from '../style/evaluation_parameters.ts';

import type {PropertyValue, PossiblyEvaluatedPropertyValue} from '../style/properties.ts';
import type {InterpolationType} from '@maplibre/maplibre-gl-style-spec';

const MAX_GLYPH_ICON_SIZE = 255;
const SIZE_PACK_FACTOR = 128;
const MAX_PACKED_SIZE: number = MAX_GLYPH_ICON_SIZE * SIZE_PACK_FACTOR;

export {getSizeData, evaluateSizeForFeature, evaluateSizeForZoom, SIZE_PACK_FACTOR, MAX_GLYPH_ICON_SIZE, MAX_PACKED_SIZE};

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

export type EvaluatedZoomSize = {uSizeT: number; uSize: number};

// For {text,icon}-size, get the bucket-level data that will be needed by
// the painter to set symbol-size-related uniforms
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

    } else {
        const {zoomStops, interpolationType} = expression;

        if (expression.kind === 'composite') {
            // calculate covering zoom stops for zoom-dependent values
            let lower = 0;
            while (lower < zoomStops.length && zoomStops[lower] <= tileZoom) lower++;
            lower = Math.max(0, lower - 1);
            let upper = lower;
            while (upper < zoomStops.length && zoomStops[upper] < tileZoom + 1) upper++;
            upper = Math.min(zoomStops.length - 1, upper);

            return {kind: 'composite', minZoom: zoomStops[lower], maxZoom: zoomStops[upper], interpolationType};
        }

        // a step's first stop is -Infinity, which is not a zoom you can evaluate
        // at, so use one just below the next stop
        const sizes = zoomStops.map((zoomStop) => expression.evaluate(
            new EvaluationParameters(zoomStop === -Infinity ? zoomStops[1] - 1 : zoomStop)));

        const layoutSize = expression.evaluate(new EvaluationParameters(tileZoom + 1));

        return {kind: 'camera', zoomStops, sizes, layoutSize, interpolationType};
    }
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

function evaluateSizeForZoom(sizeData: SizeData, zoom: number): EvaluatedZoomSize {
    let uSizeT = 0;
    let uSize = 0;

    if (sizeData.kind === 'constant') {
        uSize = sizeData.layoutSize;

    } else if (sizeData.kind === 'camera') {
        const {zoomStops, sizes, layoutSize, interpolationType} = sizeData;
        let lower = zoomStops.length - 1;
        while (lower > 0 && zoomStops[lower] > zoom) lower--;
        const upper = Math.min(lower + 1, zoomStops.length - 1);

        const t = !interpolationType ? 0 : clamp(
            Interpolate.interpolationFactor(interpolationType, zoom, zoomStops[lower], zoomStops[upper]), 0, 1);
        // the tile's collision boxes were built for layoutSize, so drawing text
        // larger than that would let labels overlap
        uSize = Math.min(interpolates.number(sizes[lower], sizes[upper], t), layoutSize);

    } else if (sizeData.kind === 'composite') {
        const {interpolationType, minZoom, maxZoom} = sizeData;

        // each feature only stores its size at these two stops, so all this can
        // do is blend between them: clamp the zoom into the pair
        uSizeT = !interpolationType ? 0 : clamp(
            Interpolate.interpolationFactor(interpolationType, zoom, minZoom, maxZoom), 0, 1);
    }

    return {uSizeT, uSize};
}
